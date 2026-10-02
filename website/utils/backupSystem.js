import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// Collects what a rebuild needs besides ~/Documents into bak/system and
// bak/home, and writes the manifest restore.sh reads. Everything machine
// specific comes from here at backup time, so restore.sh itself stays generic
// and can live in the public repo

const HOME = os.homedir();

// Home files that would be lost with the main drive and matter for a rebuild.
// Anything missing is skipped
const HOME_ITEMS = [
	".cloudflared",
	".gitconfig",
	".zshrc",
	".bashrc",
	".profile",
	".p10k.zsh",
	".inputrc",
	".ssh/authorized_keys",
	".ssh/known_hosts",
	".ssh/config",
];

// Small enough to copy every night. Anything bigger is recorded, not copied
const VOLUME_LIMIT = 200 * 1024 ** 2;
const COMPOSE_EXTRA = /^(\.env|.*\.ya?ml|.*\.env)$/;

// Commands the stack relies on, with how to get each one on a fresh install
const COMMANDS = {
	git: "sudo apt install git",
	python3: "sudo apt install python3",
	curl: "sudo apt install curl",
	zip: "sudo apt install zip",
	unzip: "sudo apt install unzip",
	rsync: "sudo apt install rsync",
	node: "Install nvm (https://github.com/nvm-sh/nvm), then: nvm install <version>",
	npm: "Comes with node",
	bun: "npm install -g bun, or curl -fsSL https://bun.sh/install | bash",
	pnpm: "npm install -g pnpm",
	pm2: "npm install -g pm2",
	docker: "https://docs.docker.com/engine/install/ then: sudo usermod -aG docker $USER and log in again",
	cloudflared: "https://pkg.cloudflare.com/ (cloudflared package)",
	smartctl: "sudo apt install smartmontools",
	kasa: "pip install python-kasa",
	crontab: "sudo apt install cron",
	findmnt: "sudo apt install util-linux",
	blkid: "sudo apt install util-linux",
};

async function capture(command, args, options = {}) {
	try {
		const { stdout } = await run(command, args, { maxBuffer: 64 * 1024 * 1024, timeout: 60000, ...options });
		return stdout;
	} catch (error) {
		return error?.stdout ?? "";
	}
}

function copyInto(source, target) {
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.cpSync(source, target, { recursive: true, dereference: false, preserveTimestamps: true });
}

function which(command) {
	for (const dir of (process.env.PATH ?? "").split(":")) {
		if (dir && fs.existsSync(path.join(dir, command))) return path.join(dir, command);
	}
	return null;
}

// Each repo also goes in as a git bundle, a single file with its full
// history, so a restore never depends on GitHub. Several repos are private,
// and a fresh machine is not signed in
async function repos(documents, systemDir) {
	const found = [];
	const walk = (dir) => {
		let entries;
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		if (entries.some((entry) => entry.name === ".git")) found.push(dir);
		for (const entry of entries) {
			if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
				walk(path.join(dir, entry.name));
			}
		}
	};
	walk(documents);

	const bundles = path.join(systemDir, "repos");
	fs.mkdirSync(bundles, { recursive: true });

	const output = [];
	for (const dir of found) {
		const relative = path.relative(documents, dir) || ".";
		const bundleName = `${relative === "." ? "root" : relative.replace(/\//g, "__")}.bundle`;
		const bundleFile = path.join(bundles, bundleName);
		await capture("git", ["-C", dir, "bundle", "create", bundleFile, "--all"], { timeout: 300000 });
		const hasBundle = fs.existsSync(bundleFile) && fs.statSync(bundleFile).size > 0;

		const remoteName = (await capture("git", ["-C", dir, "remote"])).split("\n")[0]?.trim();
		const remote = remoteName ? (await capture("git", ["-C", dir, "remote", "get-url", remoteName])).trim() : null;
		output.push({
			path: relative,
			bundle: hasBundle ? `system/repos/${bundleName}` : null,
			// Credentials in a remote URL never go into the manifest
			remote: remote?.replace(/\/\/[^@/]+@/, "//") ?? null,
			remoteName: remoteName || null,
			branch: (await capture("git", ["-C", dir, "rev-parse", "--abbrev-ref", "HEAD"])).trim() || null,
			commit: (await capture("git", ["-C", dir, "rev-parse", "HEAD"])).trim() || null,
		});
	}
	return output.sort((a, b) => a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path));
}

// A package.json with a lockfile next to it, and which tool made the lockfile
function installs(documents) {
	const output = [];
	const walk = (dir) => {
		let entries;
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		const names = new Set(entries.map((entry) => entry.name));
		// Only projects that are actually installed here, so something like
		// a mobile app that never runs on the server is not rebuilt
		if (names.has("package.json") && names.has("node_modules")) {
			const manager = names.has("bun.lock") || names.has("bun.lockb")
				? "bun"
				: names.has("pnpm-lock.yaml")
					? "pnpm"
					: names.has("package-lock.json")
						? "npm"
						: null;
			if (manager) output.push({ path: path.relative(documents, dir) || ".", manager });
		}
		for (const entry of entries) {
			if (entry.isDirectory() && !["node_modules", ".git", "dist", "build"].includes(entry.name)) {
				walk(path.join(dir, entry.name));
			}
		}
	};
	walk(documents);
	return output.sort((a, b) => a.path.localeCompare(b.path));
}

// Device names like /dev/sdd1 can change on new hardware, so each extra
// drive's UUID is kept too, letting the restore offer a stable line instead
async function mountUuids() {
	const map = new Map();
	try {
		const { blockdevices } = JSON.parse((await capture("lsblk", ["-J", "-o", "PATH,UUID,FSTYPE,MOUNTPOINT,LABEL"])) || "{}");
		const walk = (nodes) => {
			for (const node of nodes ?? []) {
				if (node.mountpoint) map.set(node.mountpoint, { uuid: node.uuid, fstype: node.fstype, label: node.label, device: node.path });
				walk(node.children);
			}
		};
		walk(blockdevices);
	} catch {}
	return map;
}

async function fstab(systemDir) {
	const uuids = await mountUuids();
	const text = fs.readFileSync("/etc/fstab", "utf-8");
	fs.writeFileSync(path.join(systemDir, "fstab"), text);

	// The system's own lines are specific to that install, so only the extra
	// drives are offered back on restore
	const extra = [];
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const [source, mount, type] = trimmed.split(/\s+/);
		if (!mount || ["/", "/boot", "/boot/efi", "none", "swap"].includes(mount) || type === "swap") continue;
		const known = uuids.get(mount);
		extra.push({ line: trimmed, source, mount, type, uuid: known?.uuid ?? null, fstype: known?.fstype ?? null, label: known?.label ?? null });
	}
	return { file: "system/fstab", extra };
}

async function docker(systemDir) {
	const names = (await capture("docker", ["ps", "-a", "--format", "{{.Names}}"])).split("\n").filter(Boolean);
	if (names.length === 0) return { containers: [], compose: [], standalone: [], volumes: [], skipped: [] };

	const inspected = JSON.parse((await capture("docker", ["inspect", ...names])) || "[]");
	const dockerDir = path.join(systemDir, "docker");
	fs.mkdirSync(dockerDir, { recursive: true });
	fs.writeFileSync(path.join(dockerDir, "containers.json"), JSON.stringify(inspected, null, 2));

	const sizes = new Map();
	for (const line of (await capture("docker", ["system", "df", "-v", "--format", "{{json .Volumes}}"])).split("\n")) {
		try {
			for (const volume of JSON.parse(line)) sizes.set(volume.Name, volume.Size);
		} catch {}
	}

	const compose = new Map();
	const standalone = [];
	// Stopped on purpose at backup time, so the restore leaves them stopped
	const stopped = inspected.filter((container) => !container.State?.Running).map((container) => container.Name.replace(/^\//, ""));
	const volumes = [];
	const skipped = [];

	for (const container of inspected) {
		const name = container.Name.replace(/^\//, "");
		const labels = container.Config?.Labels ?? {};
		const project = labels["com.docker.compose.project"];

		if (project) {
			if (!compose.has(project)) {
				const workingDir = labels["com.docker.compose.project.working_dir"];
				const configFiles = (labels["com.docker.compose.project.config_files"] ?? "").split(",").filter(Boolean);
				const saved = [];
				// The compose files and the .env files beside them, not the data
				const candidates = new Set(configFiles);
				try {
					for (const entry of fs.readdirSync(workingDir)) {
						if (COMPOSE_EXTRA.test(entry)) candidates.add(path.join(workingDir, entry));
					}
				} catch {}
				for (const file of candidates) {
					if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
					const target = path.join("docker", "compose", project, path.basename(file));
					copyInto(file, path.join(systemDir, target));
					saved.push({ original: file, saved: `system/${target}` });
				}
				compose.set(project, { project, workingDir, configFiles, files: saved, containers: [] });
			}
			compose.get(project).containers.push(name);
		} else {
			const host = container.HostConfig ?? {};
			const args = ["docker", "run", "-d", "--name", name];
			if (host.RestartPolicy?.Name && host.RestartPolicy.Name !== "no") args.push("--restart", host.RestartPolicy.Name);
			for (const [port, bindings] of Object.entries(host.PortBindings ?? {})) {
				for (const binding of bindings ?? []) args.push("-p", `${binding.HostIp ? `${binding.HostIp}:` : ""}${binding.HostPort}:${port}`);
			}
			for (const bind of host.Binds ?? []) args.push("-v", bind);
			args.push(container.Config.Image, ...(container.Config.Cmd ?? []));
			const quote = (value) => (/^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`);
			standalone.push({ name, image: container.Config.Image, run: args.map(quote).join(" ") });
		}

		for (const mount of container.Mounts ?? []) {
			if (mount.Type === "volume") {
				const size = sizes.get(mount.Name);
				const bytes = Number.parseFloat(size) * ({ B: 1, kB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 }[String(size).replace(/[\d.]/g, "")] ?? 1);
				if (Number.isFinite(bytes) && bytes > VOLUME_LIMIT) {
					skipped.push({ kind: "volume", container: name, name: mount.Name, size, reason: "Too large to copy nightly, expected to be re-downloaded" });
					continue;
				}
				// docker cp streams a tar straight out of the container, no root needed
				const target = path.join("docker", "volumes", `${mount.Name}.tar`);
				const file = path.join(systemDir, target);
				fs.mkdirSync(path.dirname(file), { recursive: true });
				const tar = await run("docker", ["cp", `${name}:${mount.Destination}`, "-"], {
					encoding: "buffer",
					maxBuffer: VOLUME_LIMIT * 2,
					timeout: 120000,
				}).catch(() => null);
				if (tar) {
					fs.writeFileSync(file, tar.stdout);
					volumes.push({ container: name, name: mount.Name, destination: mount.Destination, saved: `system/${target}` });
				} else {
					skipped.push({ kind: "volume", container: name, name: mount.Name, size, reason: "Could not be read" });
				}
			} else if (mount.Type === "bind" && mount.Source.startsWith(HOME) && !mount.Source.startsWith(path.join(HOME, "Documents"))) {
				// Big data folders in home are noted so the restore can say what to regenerate
				skipped.push({ kind: "bind", container: name, name: mount.Source, reason: "Container data in the home folder, not copied" });
			}
		}
	}

	return {
		compose: [...compose.values()],
		standalone,
		volumes,
		skipped,
		stopped,
	};
}

async function pm2(systemDir, documents) {
	const dump = path.join(HOME, ".pm2", "dump.pm2");
	const pm2Dir = path.join(systemDir, "pm2");
	fs.mkdirSync(pm2Dir, { recursive: true });
	if (fs.existsSync(dump)) copyInto(dump, path.join(pm2Dir, "dump.pm2"));

	let apps = [];
	try {
		apps = JSON.parse((await capture("pm2", ["jlist"])) || "[]").map((app) => ({
			name: app.name,
			cwd: app.pm2_env?.pm_cwd ?? null,
			script: app.pm2_env?.pm_exec_path ?? null,
		}));
	} catch {}

	const startScript = ["website/start.sh", "start.sh"].find((file) => fs.existsSync(path.join(documents, file))) ?? null;
	return { dump: fs.existsSync(dump) ? "system/pm2/dump.pm2" : null, apps, startScript };
}

export async function collectSystem(bakDir, documents, { documentsBytes = null, startedAt = null } = {}) {
	const systemDir = path.join(bakDir, "system");
	const homeDir = path.join(bakDir, "home");
	fs.mkdirSync(systemDir, { recursive: true });
	fs.mkdirSync(homeDir, { recursive: true });

	const items = [];

	const crontab = await capture("crontab", ["-l"]);
	fs.writeFileSync(path.join(systemDir, "crontab.txt"), crontab);
	items.push({ label: "crontab", path: "system/crontab.txt" });

	const fstabInfo = await fstab(systemDir);
	items.push({ label: "fstab", path: fstabInfo.file });

	let cloudflared = null;
	if (fs.existsSync("/etc/cloudflared/config.yml")) {
		copyInto("/etc/cloudflared/config.yml", path.join(systemDir, "cloudflared", "config.yml"));
		const config = fs.readFileSync("/etc/cloudflared/config.yml", "utf-8");
		cloudflared = {
			config: "system/cloudflared/config.yml",
			installTo: "/etc/cloudflared/config.yml",
			credentialsFile: config.match(/^credentials-file:\s*(.+)$/m)?.[1]?.trim() ?? null,
			serviceEnabled: (await capture("systemctl", ["is-enabled", "cloudflared"])).trim() === "enabled",
		};
		items.push({ label: "Cloudflare tunnel config", path: cloudflared.config });
	}

	if (fs.existsSync("/etc/hosts")) copyInto("/etc/hosts", path.join(systemDir, "hosts"));

	const dockerInfo = await docker(systemDir);
	items.push({ label: `Docker, ${dockerInfo.compose.length} compose projects and ${dockerInfo.volumes.length} volumes`, path: "system/docker" });

	const pm2Info = await pm2(systemDir, documents);
	items.push({ label: `pm2, ${pm2Info.apps.length} apps`, path: "system/pm2" });

	// Reference lists for a rebuild, the restore does not install from these
	fs.mkdirSync(path.join(systemDir, "packages"), { recursive: true });
	fs.writeFileSync(path.join(systemDir, "packages", "apt-manual.txt"), await capture("apt-mark", ["showmanual"]));
	fs.writeFileSync(path.join(systemDir, "packages", "snap.txt"), await capture("snap", ["list"]));
	fs.writeFileSync(path.join(systemDir, "packages", "npm-global.txt"), await capture("npm", ["ls", "-g", "--depth=0"]));
	items.push({ label: "Installed package lists", path: "system/packages" });

	const home = [];
	for (const item of HOME_ITEMS) {
		const source = path.join(HOME, item);
		if (!fs.existsSync(source)) continue;
		copyInto(source, path.join(homeDir, item));
		home.push(item);
	}
	items.push({ label: `${home.length} home files`, path: "home" });

	const nodeCurrent = path.join(HOME, ".local", "bin", "node-current");
	let nodeVersions = [];
	try {
		nodeVersions = fs.readdirSync(path.join(HOME, ".nvm", "versions", "node")).sort();
	} catch {}

	const manifest = {
		version: 1,
		// When the backup began, which the restore compares file times against
		createdAt: startedAt ?? new Date().toISOString(),
		hostname: os.hostname(),
		user: os.userInfo().username,
		os: fs.readFileSync("/etc/os-release", "utf-8").match(/^PRETTY_NAME="?([^"\n]+)"?/m)?.[1] ?? null,
		arch: os.arch(),
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		documentsBytes,
		documents: "documents",
		repos: await repos(documents, systemDir),
		installs: installs(documents),
		commands: Object.entries(COMMANDS)
			.filter(([command]) => which(command))
			.map(([command, hint]) => ({ command, hint })),
		node: {
			current: process.version,
			nvmVersions: nodeVersions,
			nodeCurrentLink: fs.existsSync(nodeCurrent) ? fs.readlinkSync(nodeCurrent) : null,
		},
		pm2: pm2Info,
		crontab: "system/crontab.txt",
		fstab: fstabInfo,
		cloudflared,
		docker: dockerInfo,
		home,
	};

	fs.writeFileSync(path.join(systemDir, "manifest.json"), JSON.stringify(manifest, null, 2));
	return { manifest, items };
}
