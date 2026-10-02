// Everything a share-code viewer receives passes through here first, so real
// names never reach their browser. Each response builds one alias map and uses
// it everywhere, so "Container 3" is the same container in every panel

const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g;
const IPV6 = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi;
const DEVICE = /\/dev\/[\w/-]+/g;

const byName = (a, b) => String(a).localeCompare(String(b));

// Aliases are handed out in sorted order, but the lists arrive in whatever
// order docker, pm2 or the drive scan produced. Sorting the output by alias,
// numerically so Drive 10 follows Drive 9, puts them back in sequence
const collator = new Intl.Collator("en", { numeric: true });
const byAlias = (key) => (a, b) => collator.compare(key(a), key(b));
const sortNames = (names) => [...names].sort((a, b) => collator.compare(a, b));

// Sorted rather than taken in the order the tools list them, so numbering does
// not shuffle between refreshes
// Extra mounts, like small ones the drive panel leaves out, are numbered after
// the main drives, so Drive 1 to 5 mean the same thing on every panel
export function buildAliases(stats, extraMounts = []) {
	const aliases = new Map();

	const containers = [...new Set((stats.containers ?? []).map((c) => c.name))].sort(byName);
	containers.forEach((name, index) => aliases.set(name, `Container ${index + 1}`));

	const services = [...new Set((stats.services ?? []).map((s) => s.name))].sort(byName);
	services.forEach((name, index) => aliases.set(name, `Service ${index + 1}`));

	const mounts = [...new Set((stats.drives ?? []).map((d) => d.mount))].sort((a, b) =>
		a === "/" ? -1 : b === "/" ? 1 : byName(a, b),
	);
	const driveAlias = new Map(mounts.map((mount, index) => [mount, `Drive ${index + 1}`]));
	for (const drive of stats.drives ?? []) {
		const alias = driveAlias.get(drive.mount);
		aliases.set(drive.mount, alias);
		if (drive.device) aliases.set(drive.device, alias);
		if (drive.disk) aliases.set(drive.disk, alias);
		if (drive.model && drive.model !== "Unknown") aliases.set(drive.model, alias);
	}

	const peers = [...(stats.vpn?.peers ?? [])].sort((a, b) => byName(a.address ?? "", b.address ?? ""));
	peers.forEach((peer, index) => aliases.set(peer.name, `Profile ${index + 1}`));

	const extras = [...new Set(extraMounts)].filter((mount) => !driveAlias.has(mount)).sort(byName);
	extras.forEach((mount, index) => aliases.set(mount, `Drive ${mounts.length + index + 1}`));

	if (stats.host?.hostname) aliases.delete(stats.host.hostname);
	return aliases;
}

function escapeRegex(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Longest names first, so "/mnt/data" is not half replaced by "/" and a
// container called "app_server" is not caught by one called "app"
export function redactText(text, aliases) {
	if (text === null || text === undefined) return text;
	let output = String(text);

	const names = [...aliases.keys()].filter((name) => name && name !== "/").sort((a, b) => b.length - a.length);
	for (const name of names) {
		output = output.replace(new RegExp(`(^|[^\\w/.-])${escapeRegex(name)}(?=$|[^\\w/.-])`, "g"), `$1${aliases.get(name)}`);
	}

	// The root mount only counts as a name when it stands alone
	if (aliases.has("/")) {
		output = output.replace(/(^|[\s(:,])\/(?=$|[\s),:])/g, `$1${aliases.get("/")}`);
	}

	return output.replace(DEVICE, "a device").replace(IPV4, "a hidden address").replace(IPV6, "a hidden address");
}

const alias = (aliases, name) => aliases.get(name) ?? name;

function redactIssues(issues, aliases) {
	return (issues ?? []).map((issue) => ({ ...issue, message: redactText(issue.message, aliases) }));
}

export function redactAlertStatus(status, aliases) {
	if (!status) return status;
	return {
		...status,
		issues: redactIssues(status.issues, aliases),
		delivered: status.delivered && {
			ok: status.delivered.ok,
			error: status.delivered.error ? redactText(status.delivered.error, aliases) : status.delivered.error,
		},
	};
}

export function redactStats(stats, aliases) {
	return {
		...stats,
		redacted: true,
		host: { hostname: stats.host?.hostname, platform: "Linux", arch: null },
		cpu: { ...stats.cpu, model: "Hidden" },
		network: { interface: null, address: null, received: stats.network?.received, transmitted: stats.network?.transmitted },
		drives: (stats.drives ?? [])
			.map((drive) => ({
			...drive,
			mount: alias(aliases, drive.mount),
			device: null,
			disk: null,
			model: alias(aliases, drive.mount),
			health: drive.health && { ...drive.health, reasons: drive.health.reasons.map((reason) => redactText(reason, aliases)) },
			}))
			.sort(byAlias((drive) => drive.mount)),
		services: (stats.services ?? [])
			.map((service) => ({ ...service, name: alias(aliases, service.name) }))
			.sort(byAlias((service) => service.name)),
		containers: (stats.containers ?? [])
			.map((container) => ({
				...container,
				name: alias(aliases, container.name),
				status: redactText(container.status, aliases),
				sharesNetworkWith: container.sharesNetworkWith ? alias(aliases, container.sharesNetworkWith) : null,
				error: null,
			}))
			.sort(byAlias((container) => container.name)),
		// Raw kernel lines name devices and paths, so only the counts are shown
		events: Object.fromEntries(
			Object.entries(stats.events ?? {}).map(([key, event]) => [key, { ...event, recent: [] }]),
		),
		vpn: stats.vpn && {
			...stats.vpn,
			peers: (stats.vpn.peers ?? [])
				.map((peer) => ({
					...peer,
					id: null,
					name: alias(aliases, peer.name),
					endpoint: null,
				}))
				.sort(byAlias((peer) => peer.name)),
		},
		alerts: redactAlertStatus(stats.alerts, aliases),
	};
}

export function redactRules(payload, aliases) {
	return {
		...payload,
		rules: payload.rules.map((rule) => ({
			...rule,
			hint: redactText(rule.hint, aliases),
			names: rule.names && sortNames(rule.names.map((name) => alias(aliases, name))),
		})),
		status: redactAlertStatus(payload.status, aliases),
		choices: {
			containers: sortNames((payload.choices?.containers ?? []).map((name) => alias(aliases, name))),
			mounts: sortNames((payload.choices?.mounts ?? []).map((name) => alias(aliases, name))),
		},
	};
}

export function redactHistory(history, aliases) {
	return {
		...history,
		drives: Object.fromEntries(Object.entries(history.drives ?? {}).map(([mount, points]) => [alias(aliases, mount), points])),
		forecasts: (history.forecasts ?? [])
			.map((forecast) => ({ ...forecast, mount: alias(aliases, forecast.mount) }))
			.sort(byAlias((forecast) => forecast.mount)),
		alerts: (history.alerts ?? []).map((event) => ({ ...event, message: redactText(event.message, aliases) })),
		outages: (history.outages ?? []).map((outage) => ({ ...outage, reason: redactText(outage.reason, aliases) })),
	};
}
