import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { promisify } from "node:util";
import { sudoExecSync } from "./utils.js";

const run = promisify(execFile);

// Only ever used against names read from lsblk, never from client input
const DEVICE_PATTERN = /^[a-z0-9]+$/;

const SMART_ATTRIBUTES = {
	5: "reallocatedSectors",
	9: "powerOnHours",
	12: "powerCycles",
	177: "wearLeveling",
	187: "reportedUncorrect",
	190: "temperature",
	192: "powerOffRetract",
	193: "loadCycles",
	194: "temperature",
	197: "pendingSectors",
	198: "uncorrectableSectors",
	199: "crcErrors",
	22: "heliumLevel",
};

const EVENT_PATTERNS = [
	{ key: "usbResets", label: "USB resets", pattern: /reset .*USB device/i },
	{
		key: "ioErrors",
		label: "Disk I/O errors",
		pattern: /I\/O error|Medium Error|unrecovered read error|critical target/i,
	},
	{ key: "oomKills", label: "Out of memory", pattern: /Out of memory|oom-kill/i },
	{ key: "filesystemErrors", label: "Filesystem errors", pattern: /EXT4-fs error|remount.*read-only/i },
	{ key: "thermalEvents", label: "Thermal events", pattern: /thermal throttl|critical temp|overheat/i },
];

const cache = new Map();

async function cached(key, ttl, producer) {
	const entry = cache.get(key);
	if (entry && Date.now() - entry.time < ttl) {
		return entry.value;
	}
	const value = await producer();
	cache.set(key, { time: Date.now(), value });
	return value;
}

// Fixed commands only, arguments are never built from request data
async function safeRun(command, args, timeout = 10000) {
	try {
		const { stdout } = await run(command, args, {
			timeout,
			maxBuffer: 16 * 1024 * 1024,
		});
		return stdout ?? "";
	} catch (error) {
		return error?.stdout ?? "";
	}
}

function readFile(file) {
	try {
		return fs.readFileSync(file, "utf-8");
	} catch {
		return "";
	}
}

function toNumber(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function readCpuSample() {
	const sample = {};
	for (const line of readFile("/proc/stat").split("\n")) {
		if (!line.startsWith("cpu")) break;
		const parts = line.trim().split(/\s+/);
		const values = parts.slice(1).map(toNumber);
		if (values.length < 5) continue;
		sample[parts[0]] = {
			idle: values[3] + values[4],
			total: values.reduce((a, b) => a + b, 0),
		};
	}
	return sample;
}

function diffCpu(previous, current) {
	const usage = {};
	for (const key of Object.keys(current)) {
		if (!previous[key]) continue;
		const idle = current[key].idle - previous[key].idle;
		const total = current[key].total - previous[key].total;
		usage[key] = total > 0 ? Math.min(100, Math.max(0, ((total - idle) / total) * 100)) : 0;
	}
	return usage;
}

let lastCpuSample = null;

async function getCpu() {
	const fresh = lastCpuSample && Date.now() - lastCpuSample.time < 30000;
	let previous = fresh ? lastCpuSample.sample : null;

	if (!previous) {
		previous = readCpuSample();
		await new Promise((resolve) => setTimeout(resolve, 200));
	}

	const current = readCpuSample();
	lastCpuSample = { time: Date.now(), sample: current };

	const usage = diffCpu(previous, current);
	const load = readFile("/proc/loadavg").trim().split(/\s+/);
	const model = readFile("/proc/cpuinfo").match(/model name\s*:\s*(.+)/)?.[1] ?? "Unknown";

	const cores = Object.keys(usage)
		.filter((key) => key !== "cpu")
		.sort((a, b) => toNumber(a.slice(3)) - toNumber(b.slice(3)))
		.map((key) => Math.round(usage[key] * 10) / 10);

	return {
		model: model.trim(),
		count: os.cpus().length,
		usage: Math.round((usage.cpu ?? 0) * 10) / 10,
		cores,
		load: [toNumber(load[0]), toNumber(load[1]), toNumber(load[2])],
	};
}

function getMemory() {
	const info = {};
	for (const line of readFile("/proc/meminfo").split("\n")) {
		const match = line.match(/^(\w+):\s+(\d+)/);
		if (match) info[match[1]] = toNumber(match[2]) * 1024;
	}

	const total = info.MemTotal ?? 0;
	const available = info.MemAvailable ?? 0;
	const used = Math.max(0, total - available);
	const swapTotal = info.SwapTotal ?? 0;
	const swapUsed = Math.max(0, swapTotal - (info.SwapFree ?? 0));

	return {
		total,
		used,
		available,
		free: info.MemFree ?? 0,
		cached: (info.Cached ?? 0) + (info.Buffers ?? 0),
		percent: total ? (used / total) * 100 : 0,
		swap: {
			total: swapTotal,
			used: swapUsed,
			percent: swapTotal ? (swapUsed / swapTotal) * 100 : 0,
		},
	};
}

function getUptime() {
	const seconds = toNumber(readFile("/proc/uptime").split(" ")[0]);
	return {
		seconds,
		bootedAt: new Date(Date.now() - seconds * 1000).toISOString(),
	};
}

function getTemperatures() {
	const zones = [];
	let entries = [];

	try {
		entries = fs.readdirSync("/sys/class/thermal");
	} catch {
		return zones;
	}

	for (const entry of entries) {
		if (!entry.startsWith("thermal_zone")) continue;
		const base = `/sys/class/thermal/${entry}`;
		const label = readFile(`${base}/type`).trim();
		const value = toNumber(readFile(`${base}/temp`).trim()) / 1000;
		if (!label || value <= 0 || value > 150) continue;
		zones.push({ label, value: Math.round(value * 10) / 10 });
	}

	return zones.sort((a, b) => b.value - a.value);
}

// Kernel error counters survive reboots and are the filesystem's own record
function getFilesystemErrorCounters() {
	const counters = [];
	let entries = [];

	try {
		entries = fs.readdirSync("/sys/fs/ext4");
	} catch {
		return counters;
	}

	for (const entry of entries) {
		const raw = readFile(`/sys/fs/ext4/${entry}/errors_count`).trim();
		if (raw === "") continue;
		counters.push({ device: entry, errors: toNumber(raw) });
	}

	return counters;
}

function flattenMounts(nodes, output = []) {
	for (const node of nodes ?? []) {
		if (node.source?.startsWith("/dev/")) {
			output.push({
				device: node.source,
				mount: node.target,
				fstype: node.fstype,
				size: toNumber(node.size),
				used: toNumber(node.used),
				avail: toNumber(node.avail),
				percent: toNumber(String(node["use%"]).replace("%", "")),
			});
		}
		flattenMounts(node.children, output);
	}
	return output;
}

function flattenBlockDevices(nodes, output = []) {
	for (const node of nodes ?? []) {
		output.push(node);
		flattenBlockDevices(node.children, output);
	}
	return output;
}

function parentDisk(device) {
	const name = device.replace("/dev/", "");
	return name.startsWith("nvme") ? name.replace(/p\d+$/, "") : name.replace(/\d+$/, "");
}

function parseAtaSmart(output) {
	const data = { type: "ata", attributes: {} };

	data.model = output.match(/Device Model:\s*(.+)/)?.[1]?.trim();
	data.serial = output.match(/Serial Number:\s*(.+)/)?.[1]?.trim();
	data.passed = /SMART overall-health self-assessment test result:\s*PASSED/i.test(output);
	data.failed = /SMART overall-health self-assessment test result:\s*FAILED/i.test(output);

	for (const line of output.split("\n")) {
		const match = line.match(/^\s*(\d+)\s+(\S+)\s+0x[0-9a-fA-F]+\s+(\d+)\s+(\d+)\s+(\d+)\s+\S+\s+\S+\s+\S+\s+(\S+)/);
		if (!match) continue;
		const id = toNumber(match[1]);
		const key = SMART_ATTRIBUTES[id];
		if (!key) continue;
		data.attributes[key] = toNumber(match[6].split(" ")[0]);
	}

	return data;
}

function parseNvmeSmart(output) {
	const data = { type: "nvme", attributes: {} };

	data.model = output.match(/Model Number:\s*(.+)/)?.[1]?.trim();
	data.serial = output.match(/Serial Number:\s*(.+)/)?.[1]?.trim();
	data.passed = /SMART overall-health self-assessment test result:\s*PASSED/i.test(output);
	data.failed = /SMART overall-health self-assessment test result:\s*FAILED/i.test(output);

	const pick = (label) => {
		const match = output.match(new RegExp(`${label}:\\s*(.+)`));
		if (!match) return undefined;
		const value = match[1].replace(/,/g, "").trim().match(/^-?\d+(\.\d+)?/);
		return value ? Number(value[0]) : undefined;
	};

	data.attributes = {
		percentageUsed: pick("Percentage Used"),
		availableSpare: pick("Available Spare"),
		temperature: pick("Temperature"),
		powerOnHours: pick("Power On Hours"),
		powerCycles: pick("Power Cycles"),
		unsafeShutdowns: pick("Unsafe Shutdowns"),
		mediaErrors: pick("Media and Data Integrity Errors"),
		errorLogEntries: pick("Error Information Log Entries"),
	};

	data.criticalWarning = output.match(/Critical Warning:\s*(\S+)/)?.[1];

	return data;
}

function verdictFor(smart) {
	if (!smart) return { status: "unknown", reasons: ["SMART data unavailable"] };
	if (smart.standby) return { status: "standby", reasons: ["Drive is asleep, left undisturbed"] };

	const reasons = [];
	const attributes = smart.attributes ?? {};

	if (smart.failed) reasons.push("SMART self-assessment reports FAILED");
	if (attributes.reallocatedSectors > 0) reasons.push(`${attributes.reallocatedSectors} reallocated sectors`);
	if (attributes.pendingSectors > 0) reasons.push(`${attributes.pendingSectors} pending sectors`);
	if (attributes.uncorrectableSectors > 0) reasons.push(`${attributes.uncorrectableSectors} uncorrectable sectors`);
	if (attributes.mediaErrors > 0) reasons.push(`${attributes.mediaErrors} media integrity errors`);
	if (smart.criticalWarning && smart.criticalWarning !== "0x00") reasons.push(`Critical warning ${smart.criticalWarning}`);

	if (reasons.length > 0) return { status: "critical", reasons };

	if (attributes.crcErrors > 0) reasons.push(`${attributes.crcErrors} CRC errors on the cable`);
	if (attributes.availableSpare !== undefined && attributes.availableSpare < 20) reasons.push(`Spare capacity at ${attributes.availableSpare}%`);
	if (attributes.percentageUsed !== undefined && attributes.percentageUsed > 80) reasons.push(`${attributes.percentageUsed}% of write endurance used`);

	if (reasons.length > 0) return { status: "warning", reasons };

	return { status: "healthy", reasons: [] };
}

function smartForDevice(name) {
	if (!DEVICE_PATTERN.test(name)) return null;

	const isNvme = name.startsWith("nvme");

	// -n standby so polling never spins a sleeping drive back up
	const command = isNvme
		? `smartctl -a /dev/${name}`
		: `smartctl -a -n standby -d sat /dev/${name}`;

	let output = "";
	try {
		output = sudoExecSync(command);
	} catch (error) {
		output = error?.stdout ?? "";
	}

	if (/STANDBY|SLEEP mode/i.test(output)) {
		return { standby: true, attributes: {} };
	}

	if (!output || /Read Device Identity failed|Unknown USB bridge|Permission denied/i.test(output)) {
		return null;
	}

	return isNvme ? parseNvmeSmart(output) : parseAtaSmart(output);
}

async function getDrives() {
	const mountsRaw = await safeRun("findmnt", [
		"-J", "-b",
		"-o", "SOURCE,TARGET,FSTYPE,SIZE,USED,AVAIL,USE%",
		"-t", "ext4,ext3,xfs,btrfs,fuseblk,ntfs,vfat",
	]);

	const blockRaw = await safeRun("lsblk", [
		"-J", "-b",
		"-o", "NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,MODEL,TRAN,ROTA",
	]);

	let mounts = [];
	let blockDevices = [];

	try {
		mounts = flattenMounts(JSON.parse(mountsRaw || "{}").filesystems);
	} catch {}

	try {
		blockDevices = flattenBlockDevices(JSON.parse(blockRaw || "{}").blockdevices);
	} catch {}

	const byName = new Map(blockDevices.map((device) => [device.name, device]));
	const errorCounters = new Map(getFilesystemErrorCounters().map((entry) => [entry.device, entry.errors]));

	const smartCache = await cached("smart", 300000, async () => {
		const disks = new Set(mounts.map((mount) => parentDisk(mount.device)));
		const results = {};
		for (const disk of disks) {
			results[disk] = smartForDevice(disk);
		}
		return results;
	});

	return mounts
		.filter((mount) => mount.size > 1024 * 1024 * 1024)
		.map((mount) => {
			const disk = parentDisk(mount.device);
			const block = byName.get(disk);
			const partition = byName.get(mount.device.replace("/dev/", ""));
			const smart = smartCache[disk] ?? null;

			return {
				...mount,
				disk,
				model: smart?.model ?? block?.model?.trim() ?? "Unknown",
				transport: block?.tran ?? "internal",
				rotational: block?.rota ?? null,
				filesystemErrors: errorCounters.get(mount.device.replace("/dev/", "")) ?? null,
				smart: smart && !smart.standby ? { type: smart.type, attributes: smart.attributes } : null,
				health: verdictFor(smart),
				partitionSize: toNumber(partition?.size),
			};
		})
		.sort((a, b) => b.size - a.size);
}

// Detects boots that were never preceded by a clean shutdown record
async function getPowerHistory() {
	const output = await safeRun("last", ["-x", "-F", "reboot", "shutdown"]);
	const entries = [];

	for (const line of output.split("\n")) {
		const match = line.match(/^(reboot|shutdown)\s+system\s+(?:boot|down)\s+\S+\s+(\w{3} \w{3} +\d+ [\d:]+ \d{4})/);
		if (!match) continue;
		const time = new Date(match[2]);
		if (Number.isNaN(time.getTime())) continue;
		entries.push({ type: match[1] === "reboot" ? "boot" : "shutdown", time });
	}

	const unclean = [];
	for (let index = 0; index < entries.length; index += 1) {
		if (entries[index].type !== "boot") continue;
		const next = entries[index + 1];
		if (next && next.type === "boot") {
			unclean.push({
				recoveredAt: entries[index].time.toISOString(),
				previousBootStarted: next.time.toISOString(),
			});
		}
	}

	const boots = entries.filter((entry) => entry.type === "boot").length;

	return {
		boots,
		cleanShutdowns: entries.filter((entry) => entry.type === "shutdown").length,
		uncleanShutdowns: unclean.slice(0, 10),
		uncleanCount: unclean.length,
	};
}

// The last thing the previous boot logged tells us when power actually went away
async function getLastCrash() {
	const lastLine = await safeRun("journalctl", ["-b", "-1", "-n", "1", "-o", "short-iso", "--no-pager"]);
	const timestamp = lastLine.match(/^(\d{4}-\d{2}-\d{2}T[\d:]+[+-]\d{4})/m)?.[1];
	if (!timestamp) return null;

	const endedAt = new Date(timestamp.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
	if (Number.isNaN(endedAt.getTime())) return null;

	const uptime = getUptime();
	const bootedAt = new Date(uptime.bootedAt);
	const downtime = Math.max(0, (bootedAt.getTime() - endedAt.getTime()) / 1000);

	return {
		previousBootEndedAt: endedAt.toISOString(),
		currentBootStartedAt: bootedAt.toISOString(),
		downtimeSeconds: downtime,
	};
}

async function getKernelEvents() {
	const output = await safeRun("journalctl", ["-b", "-k", "--no-pager", "-o", "short-iso", "-n", "4000"]);
	const lines = output.split("\n");
	const events = {};

	for (const { key, label, pattern } of EVENT_PATTERNS) {
		const matched = lines.filter((line) => pattern.test(line));
		events[key] = {
			label,
			count: matched.length,
			recent: matched.slice(-3).map((line) => line.trim()),
		};
	}

	return events;
}

async function getServices() {
	const output = await safeRun("pm2", ["jlist"]);

	try {
		return JSON.parse(output || "[]").map((process) => ({
			name: process.name,
			status: process.pm2_env?.status ?? "unknown",
			restarts: toNumber(process.pm2_env?.restart_time),
			uptime: process.pm2_env?.pm_uptime ?? null,
			cpu: process.monit?.cpu ?? 0,
			memory: process.monit?.memory ?? 0,
		}));
	} catch {
		return [];
	}
}

async function getContainers() {
	const output = await safeRun("docker", ["ps", "-a", "--format", "{{.Names}}|{{.State}}|{{.Status}}"]);

	return output
		.trim()
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const [name, state, status] = line.split("|");
			return { name, state, status };
		});
}

async function getNetwork() {
	const routeOutput = await safeRun("ip", ["-4", "route", "show", "default"]);
	const iface = routeOutput.match(/dev\s+(\S+)/)?.[1] ?? null;
	if (!iface) return { interface: null };

	const addressOutput = await safeRun("ip", ["-4", "-o", "addr", "show", "dev", iface]);
	const address = addressOutput.match(/inet\s+(\S+)/)?.[1] ?? null;

	let received = 0;
	let transmitted = 0;
	for (const line of readFile("/proc/net/dev").split("\n")) {
		const [name, values] = line.split(":");
		if (name?.trim() !== iface || !values) continue;
		const parts = values.trim().split(/\s+/).map(toNumber);
		received = parts[0];
		transmitted = parts[8];
	}

	return { interface: iface, address, received, transmitted };
}

export async function collectServerStats() {
	const [cpu, drives, power, lastCrash, events, services, containers, network] = await Promise.all([
		getCpu(),
		cached("drives", 15000, getDrives),
		cached("power", 300000, getPowerHistory),
		cached("lastCrash", 300000, getLastCrash),
		cached("events", 60000, getKernelEvents),
		cached("services", 10000, getServices),
		cached("containers", 15000, getContainers),
		cached("network", 10000, getNetwork),
	]);

	return {
		generatedAt: new Date().toISOString(),
		host: {
			hostname: os.hostname(),
			platform: `${os.type()} ${os.release()}`,
			arch: os.arch(),
		},
		uptime: getUptime(),
		cpu,
		memory: getMemory(),
		temperatures: getTemperatures(),
		drives,
		power: { ...power, lastCrash },
		events,
		services,
		containers,
		network,
	};
}
