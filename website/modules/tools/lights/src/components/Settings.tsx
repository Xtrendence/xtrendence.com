import { useEffect, useMemo, useRef, useState } from "react";
import type { TAlertLevel, TPlugStatus, TSettings } from "../../shared/types";
import {
	useCyclePlug,
	usePlugStatus,
	useSaveSettings,
	useSettings,
} from "../hooks/useSettings";

type TDraftBulb = {
	key: string;
	id?: number;
	name: string;
	ip: string;
	mac: string;
	removed: boolean;
};

type TDraftHost = { key: string; value: string };

type TDraftPlug = {
	key: string;
	id?: number;
	name: string;
	ip: string;
	// Kept as typed, so a half written number like "1." is not lost
	interval: string;
	quiet: TDraftQuiet[];
	removed: boolean;
};

type TDraftQuiet = { key: string; start: string; end: string };

type TDraft = {
	bulbs: TDraftBulb[];
	hosts: TDraftHost[];
	alerts: TSettings["alerts"];
	plugs: TDraftPlug[];
};

// Mirrors the limits in api/plugs.ts
const MIN_HOURS = 0.25;
const MAX_HOURS = 720;

const ALERT_STATES: Record<
	TAlertLevel | "none",
	{ label: string; tone: string }
> = {
	none: { label: "No report from the server yet", tone: "idle" },
	ok: { label: "Server reports all clear", tone: "ok" },
	soft: { label: "Server reports a warning", tone: "soft" },
	hard: { label: "Server reports a critical issue", tone: "hard" },
};

// Mirrors the checks in api/lights.ts so problems show before saving
const hostPattern =
	/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i;
const climateHostPattern =
	/^(?:https?:\/\/)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::\d{1,5})?\/?$/i;
const macPattern = /^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;

let keySeed = 0;
const nextKey = () => `draft-${++keySeed}`;

function toDraft(settings: TSettings): TDraft {
	return {
		bulbs: settings.lights.map((light) => ({
			key: nextKey(),
			id: light.id,
			name: light.name,
			ip: light.ip,
			mac: light.mac,
			removed: false,
		})),
		hosts: settings.climateHosts.map((value) => ({ key: nextKey(), value })),
		alerts: { ...settings.alerts },
		plugs: (settings.plugs ?? []).map((plug) => ({
			key: nextKey(),
			id: plug.id,
			name: plug.name,
			ip: plug.ip,
			interval: String(plug.intervalHours),
			quiet: (plug.quietHours ?? []).map((range) => ({
				key: nextKey(),
				...range,
			})),
			removed: false,
		})),
	};
}

function toPayload(draft: TDraft) {
	return {
		lights: draft.bulbs
			.filter((bulb) => !bulb.removed)
			.map(({ id, name, ip, mac }) => ({
				id,
				name: name.trim(),
				ip: ip.trim(),
				mac: mac.trim().toUpperCase().replace(/-/g, ":"),
			})),
		climateHosts: draft.hosts.map((host) =>
			host.value.trim().replace(/\/+$/, ""),
		),
		alerts: draft.alerts,
		plugs: draft.plugs
			.filter((plug) => !plug.removed)
			.map(({ id, name, ip, interval, quiet }) => ({
				id,
				name: name.trim(),
				ip: ip.trim(),
				intervalHours: Number(interval),
				quietHours: quiet.map(({ start, end }) => ({ start, end })),
			})),
	};
}

function plugErrors(plug: TDraftPlug) {
	const hours = Number(plug.interval);
	return {
		name: !plug.name.trim(),
		ip: !hostPattern.test(plug.ip.trim()),
		interval:
			!plug.interval.trim() ||
			!Number.isFinite(hours) ||
			hours < MIN_HOURS ||
			hours > MAX_HOURS,
		quiet: plug.quiet.some(quietInvalid),
	};
}

// Mirrors api/plugs.ts, apart from the whole day check done on save
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const quietInvalid = (range: TDraftQuiet) =>
	!timePattern.test(range.start) ||
	!timePattern.test(range.end) ||
	range.start === range.end;

const toMinutes = (time: string) => {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
};

// Percentages along a 24 hour strip. Past midnight is two pieces
function quietSegments(range: TDraftQuiet) {
	if (quietInvalid(range)) {
		return [];
	}
	const start = (toMinutes(range.start) / 1440) * 100;
	const end = (toMinutes(range.end) / 1440) * 100;
	return end > start
		? [{ left: start, width: end - start }]
		: [
				{ left: start, width: 100 - start },
				{ left: 0, width: end },
			].filter((segment) => segment.width > 0);
}

function untilText(ms: number) {
	const minutes = Math.max(0, Math.round(ms / 60000));
	if (minutes < 1) {
		return "under a minute";
	}
	if (minutes < 60) {
		return `${minutes} min`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 48) {
		return `${hours} h ${minutes % 60} min`;
	}
	return `${Math.round(hours / 24)} days`;
}

function clockText(time: number) {
	return new Date(time).toLocaleString("en-GB", {
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function plugStatusLine(status: TPlugStatus | undefined) {
	if (!status) {
		return { tone: "idle", text: "Checking the plug..." };
	}
	if (status.busy) {
		return { tone: "busy", text: "Restarting now, off for 10 seconds" };
	}
	if (status.pendingOn) {
		return {
			tone: "bad",
			text: `Left off by a restart, on is sent every minute until it answers. ${status.lastError ?? ""}`.trim(),
		};
	}
	if (!status.online) {
		return { tone: "bad", text: "Offline, its IP is not answering" };
	}
	const moved = status.movedFrom
		? `, moved from ${clockText(status.movedFrom)} by quiet hours`
		: "";
	const next = `next restart in ${untilText(status.nextCycleAt - Date.now())}${moved}`;
	const last = status.lastCycleAt
		? `, last ${clockText(status.lastCycleAt)}`
		: "";
	const failed =
		status.lastResult === "failed" && status.lastError
			? `. Last try failed: ${status.lastError}`
			: "";
	return { tone: "ok", text: `Online, ${next}${last}${failed}` };
}

function bulbErrors(bulb: TDraftBulb) {
	return {
		name: !bulb.name.trim(),
		ip: !hostPattern.test(bulb.ip.trim()),
		mac: !macPattern.test(bulb.mac.trim()),
	};
}

const pad = (n: number) => String(n).padStart(2, "0");

export function Settings({
	open,
	onClose,
}: { open: boolean; onClose: () => void }) {
	const settings = useSettings(open);
	const save = useSaveSettings();
	const plugStatus = usePlugStatus(open);
	const cyclePlug = useCyclePlug();
	const [armedPlug, setArmedPlug] = useState<number | null>(null);
	const panel = useRef<HTMLElement>(null);

	const [draft, setDraft] = useState<TDraft | null>(null);
	const [saved, setSaved] = useState(false);

	// Edits survive reopening unless the settings changed underneath
	useEffect(() => {
		if (settings.data) {
			setDraft(toDraft(settings.data));
		}
	}, [settings.data]);

	useEffect(() => {
		if (!open) {
			return;
		}

		panel.current?.focus();

		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};

		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	const payload = useMemo(() => (draft ? toPayload(draft) : null), [draft]);

	const dirty = useMemo(() => {
		if (!payload || !settings.data) {
			return false;
		}
		const baseline = toPayload(toDraft(settings.data));
		return JSON.stringify(payload) !== JSON.stringify(baseline);
	}, [payload, settings.data]);

	// Only saved bulbs have an id the server can point alerts at
	const alertCandidates = useMemo(
		() =>
			draft?.bulbs.filter((bulb) => bulb.id !== undefined && !bulb.removed) ??
			[],
		[draft],
	);

	const alertBulbMissing = Boolean(
		draft?.alerts.enabled &&
			!alertCandidates.some((bulb) => bulb.id === draft.alerts.bulbId),
	);

	const problem = useMemo(() => {
		if (!draft) {
			return "Loading";
		}
		const bulbsInvalid = draft.bulbs.some((bulb) => {
			if (bulb.removed) {
				return false;
			}
			const errors = bulbErrors(bulb);
			return errors.name || errors.ip || errors.mac;
		});
		if (bulbsInvalid) {
			return "Every bulb needs a name, IP and MAC";
		}
		const hostsInvalid = draft.hosts.some(
			(host) => !climateHostPattern.test(host.value.trim()),
		);
		if (hostsInvalid || !draft.hosts.length) {
			return "Check the climate sensor addresses";
		}
		if (alertBulbMissing) {
			return "Pick a bulb for server alerts";
		}
		const plugsInvalid = draft.plugs.some((plug) => {
			if (plug.removed) {
				return false;
			}
			const errors = plugErrors(plug);
			return errors.name || errors.ip || errors.interval;
		});
		if (plugsInvalid) {
			return `Every plug needs a name, IP and an interval of ${MIN_HOURS} to ${MAX_HOURS} hours`;
		}
		const quietBad = draft.plugs.some(
			(plug) => !plug.removed && plugErrors(plug).quiet,
		);
		if (quietBad) {
			return "Quiet hours need a start and end that differ";
		}
		return null;
	}, [draft, alertBulbMissing]);

	const invalid = problem !== null;

	const touch = () => {
		setSaved(false);
		if (save.isError) {
			save.reset();
		}
	};

	const updateBulb = (key: string, patch: Partial<TDraftBulb>) => {
		touch();
		setDraft(
			(prev) =>
				prev && {
					...prev,
					bulbs: prev.bulbs.map((bulb) =>
						bulb.key === key ? { ...bulb, ...patch } : bulb,
					),
				},
		);
	};

	const removeBulb = (bulb: TDraftBulb) => {
		// A bulb that was never saved has nothing to restore, so it just goes
		if (bulb.id === undefined) {
			setDraft(
				(prev) =>
					prev && {
						...prev,
						bulbs: prev.bulbs.filter((b) => b.key !== bulb.key),
					},
			);
			return;
		}
		updateBulb(bulb.key, { removed: !bulb.removed });
	};

	const addBulb = () => {
		touch();
		setDraft(
			(prev) =>
				prev && {
					...prev,
					bulbs: [
						...prev.bulbs,
						{ key: nextKey(), name: "", ip: "", mac: "", removed: false },
					],
				},
		);
	};

	const updateHost = (key: string, value: string) => {
		touch();
		setDraft(
			(prev) =>
				prev && {
					...prev,
					hosts: prev.hosts.map((host) =>
						host.key === key ? { ...host, value } : host,
					),
				},
		);
	};

	const removeHost = (key: string) => {
		touch();
		setDraft(
			(prev) =>
				prev && { ...prev, hosts: prev.hosts.filter((h) => h.key !== key) },
		);
	};

	const addHost = () => {
		touch();
		setDraft(
			(prev) =>
				prev && {
					...prev,
					hosts: [...prev.hosts, { key: nextKey(), value: "" }],
				},
		);
	};

	const updatePlug = (key: string, patch: Partial<TDraftPlug>) => {
		touch();
		setDraft(
			(prev) =>
				prev && {
					...prev,
					plugs: prev.plugs.map((plug) =>
						plug.key === key ? { ...plug, ...patch } : plug,
					),
				},
		);
	};

	const removePlug = (plug: TDraftPlug) => {
		if (plug.id === undefined) {
			setDraft(
				(prev) =>
					prev && {
						...prev,
						plugs: prev.plugs.filter((p) => p.key !== plug.key),
					},
			);
			return;
		}
		updatePlug(plug.key, { removed: !plug.removed });
	};

	const addPlug = () => {
		touch();
		setDraft(
			(prev) =>
				prev && {
					...prev,
					plugs: [
						...prev.plugs,
						{
							key: nextKey(),
							name: "",
							ip: "",
							interval: "24",
							quiet: [],
							removed: false,
						},
					],
				},
		);
	};

	const updateQuiet = (plug: TDraftPlug, quiet: TDraftPlug["quiet"]) =>
		updatePlug(plug.key, { quiet });

	// Two taps, since it cuts power to whatever is plugged in
	const restartPlug = (id: number) => {
		if (armedPlug !== id) {
			setArmedPlug(id);
			setTimeout(
				() => setArmedPlug((current) => (current === id ? null : current)),
				4000,
			);
			return;
		}
		setArmedPlug(null);
		cyclePlug.mutate(id);
	};

	const updateAlerts = (patch: Partial<TSettings["alerts"]>) => {
		touch();
		setDraft(
			(prev) => prev && { ...prev, alerts: { ...prev.alerts, ...patch } },
		);
	};

	const discard = () => {
		touch();
		if (settings.data) {
			setDraft(toDraft(settings.data));
		}
	};

	const submit = () => {
		if (!payload || invalid) {
			return;
		}
		save.mutate(payload, {
			onSuccess: () => setSaved(true),
		});
	};

	const alertState =
		ALERT_STATES[settings.data?.alertLevel ?? "none"] ?? ALERT_STATES.none;

	const liveCount = draft?.bulbs.filter((bulb) => !bulb.removed).length ?? 0;

	const status = save.isError
		? save.error.message
		: save.isPending
			? "Writing to the bridge..."
			: problem && draft
				? problem
				: dirty
					? "Unsaved changes"
					: saved
						? "Saved"
						: "Everything is saved";

	return (
		<>
			<div
				className={`settings-scrim${open ? " open" : ""}`}
				aria-hidden="true"
				onClick={onClose}
			/>

			<section
				ref={panel}
				className={`settings glass${open ? " open" : ""}`}
				aria-label="Settings"
				tabIndex={-1}
			>
				<header className="settings-head">
					<span className="eyebrow">Settings</span>
					<h2>Bulbs, plugs and sensor</h2>
				</header>

				{!draft ? (
					<div className="settings-body">
						<div className="empty">
							{settings.isError
								? "The bridge is not answering."
								: "Reading lights.txt..."}
						</div>
					</div>
				) : (
					<div className="settings-body">
						<div className="section-head">
							<h3>Bulbs</h3>
							<span className="tally">{pad(liveCount)}</span>
							<button className="ghost-btn" type="button" onClick={addBulb}>
								<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
									<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
								</svg>
								Add bulb
							</button>
						</div>

						{draft.bulbs.length ? (
							<ol className="bulb-list">
								{draft.bulbs.map((bulb, index) => {
									const errors = bulbErrors(bulb);
									const isNew = bulb.id === undefined;

									return (
										<li
											key={bulb.key}
											className={`bulb-row${bulb.removed ? " is-removed" : ""}${isNew ? " is-new" : ""}`}
											style={{ "--i": index } as React.CSSProperties}
										>
											<span className="bulb-index" aria-hidden="true">
												{pad(index + 1)}
											</span>

											<div className="bulb-fields">
												<label className="field field--name">
													<span>
														Name
														{isNew && <em>New</em>}
														{bulb.removed && <em>Removing on save</em>}
													</span>
													<input
														value={bulb.name}
														placeholder="Office 3"
														maxLength={64}
														disabled={bulb.removed}
														aria-invalid={!bulb.removed && errors.name}
														onChange={(e) =>
															updateBulb(bulb.key, { name: e.target.value })
														}
													/>
												</label>
												<label className="field">
													<span>IP</span>
													<input
														className="mono"
														value={bulb.ip}
														placeholder="192.168.1.100"
														inputMode="decimal"
														autoCapitalize="off"
														spellCheck={false}
														disabled={bulb.removed}
														aria-invalid={
															!bulb.removed &&
															Boolean(bulb.ip || !isNew) &&
															errors.ip
														}
														onChange={(e) =>
															updateBulb(bulb.key, { ip: e.target.value })
														}
													/>
												</label>
												<label className="field">
													<span>MAC</span>
													<input
														className="mono"
														value={bulb.mac}
														placeholder="AA:BB:CC:DD:EE:FF"
														autoCapitalize="characters"
														spellCheck={false}
														disabled={bulb.removed}
														aria-invalid={
															!bulb.removed &&
															Boolean(bulb.mac || !isNew) &&
															errors.mac
														}
														onChange={(e) =>
															updateBulb(bulb.key, { mac: e.target.value })
														}
													/>
												</label>
											</div>

											<button
												className={`icon-btn${bulb.removed ? "" : " icon-btn--danger"}`}
												type="button"
												aria-label={
													bulb.removed
														? `Keep ${bulb.name}`
														: `Remove ${bulb.name || "bulb"}`
												}
												title={bulb.removed ? "Keep" : "Remove"}
												onClick={() => removeBulb(bulb)}
											>
												{bulb.removed ? (
													<svg
														viewBox="0 0 24 24"
														fill="currentColor"
														aria-hidden="true"
													>
														<path d="M12.5 8H7.8l2.6-2.6L9 4 4 9l5 5 1.4-1.4L7.8 10h4.7a4.5 4.5 0 0 1 0 9H8v2h4.5a6.5 6.5 0 0 0 0-13Z" />
													</svg>
												) : (
													<svg
														viewBox="0 0 24 24"
														fill="currentColor"
														aria-hidden="true"
													>
														<path d="M9 3h6l1 2h4v2H4V5h4l1-2ZM6 9h12l-.9 11.1A2 2 0 0 1 15.1 22H8.9a2 2 0 0 1-2-1.9L6 9Zm4 3v7h1.5v-7H10Zm2.5 0v7H14v-7h-1.5Z" />
													</svg>
												)}
											</button>
										</li>
									);
								})}
							</ol>
						) : (
							<p className="hint">
								No bulbs yet. Add one with its IP and MAC address.
							</p>
						)}

						<hr className="rule" />

						<div className="section-head">
							<h3>Climate sensor</h3>
							<button className="ghost-btn" type="button" onClick={addHost}>
								<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
									<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
								</svg>
								Add address
							</button>
						</div>
						<p className="hint">
							One sensor, reached by whichever address answers first, tried top
							to bottom.
						</p>

						<ol className="host-list">
							{draft.hosts.map((host, index) => (
								<li key={host.key} className="host-row">
									<span className="host-rank">
										{index === 0 ? "Primary" : "Fallback"}
									</span>
									<input
										className="mono"
										value={host.value}
										placeholder="192.168.1.160"
										autoCapitalize="off"
										spellCheck={false}
										aria-label={`Climate sensor address ${index + 1}`}
										aria-invalid={
											Boolean(host.value) &&
											!climateHostPattern.test(host.value.trim())
										}
										onChange={(e) => updateHost(host.key, e.target.value)}
									/>
									<button
										className="host-remove"
										type="button"
										aria-label={`Remove ${host.value || "address"}`}
										disabled={draft.hosts.length === 1}
										onClick={() => removeHost(host.key)}
									>
										<svg
											viewBox="0 0 24 24"
											fill="currentColor"
											aria-hidden="true"
										>
											<path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
										</svg>
									</button>
								</li>
							))}
						</ol>

						<hr className="rule" />

						<div className="section-head">
							<h3>Smart plugs</h3>
							<span className="tally">
								{pad(draft.plugs.filter((plug) => !plug.removed).length)}
							</span>
							<button className="ghost-btn" type="button" onClick={addPlug}>
								<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
									<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
								</svg>
								Add plug
							</button>
						</div>
						<p className="hint">
							Each plug is switched off for 10 seconds and back on at its
							interval, counted from when it was added or last restarted.
						</p>

						{draft.plugs.length ? (
							<ol className="bulb-list">
								{draft.plugs.map((plug, index) => {
									const errors = plugErrors(plug);
									const isNew = plug.id === undefined;
									const saved = settings.data?.plugs?.find(
										(entry) => entry.id === plug.id,
									);
									const line =
										plug.id !== undefined && !plug.removed
											? plugStatusLine(plugStatus.data?.[plug.id])
											: null;
									// Restarting uses the saved settings, so edits must be saved first
									const edited =
										!saved ||
										saved.ip !== plug.ip.trim() ||
										saved.name !== plug.name.trim();

									return (
										<li
											key={plug.key}
											className={`bulb-row plug-row${plug.removed ? " is-removed" : ""}${isNew ? " is-new" : ""}`}
											style={{ "--i": index } as React.CSSProperties}
										>
											<span className="bulb-index" aria-hidden="true">
												{pad(index + 1)}
											</span>

											<div className="bulb-fields">
												<label className="field field--name">
													<span>
														Name
														{isNew && <em>New</em>}
														{plug.removed && <em>Removing on save</em>}
													</span>
													<input
														value={plug.name}
														placeholder="Plug Name"
														maxLength={64}
														disabled={plug.removed}
														aria-invalid={!plug.removed && errors.name}
														onChange={(e) =>
															updatePlug(plug.key, { name: e.target.value })
														}
													/>
												</label>
												<label className="field">
													<span>IP</span>
													<input
														className="mono"
														value={plug.ip}
														placeholder="192.168.1.23"
														inputMode="decimal"
														autoCapitalize="off"
														spellCheck={false}
														disabled={plug.removed}
														aria-invalid={
															!plug.removed &&
															Boolean(plug.ip || !isNew) &&
															errors.ip
														}
														onChange={(e) =>
															updatePlug(plug.key, { ip: e.target.value })
														}
													/>
												</label>
												<label className="field">
													<span>Restart every (hours)</span>
													<input
														className="mono"
														type="number"
														min={MIN_HOURS}
														max={MAX_HOURS}
														step="0.25"
														value={plug.interval}
														disabled={plug.removed}
														aria-invalid={!plug.removed && errors.interval}
														onChange={(e) =>
															updatePlug(plug.key, { interval: e.target.value })
														}
													/>
												</label>

												<div
													className={`quiet${plug.quiet.length ? "" : " is-empty"}`}
												>
													<div className="quiet-head">
														<span className="quiet-title">Quiet hours</span>
														<span className="quiet-note">
															{plug.quiet.length
																? "Restarts move 5 min outside these"
																: "None, restarts happen whenever due"}
														</span>
														<button
															className="quiet-add"
															type="button"
															disabled={plug.removed || plug.quiet.length >= 12}
															onClick={() =>
																updateQuiet(plug, [
																	...plug.quiet,
																	{
																		key: nextKey(),
																		start: "09:00",
																		end: "10:00",
																	},
																])
															}
														>
															<svg
																viewBox="0 0 24 24"
																fill="currentColor"
																aria-hidden="true"
															>
																<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
															</svg>
															Range
														</button>
													</div>

													{plug.quiet.length > 0 && (
														<>
															<div className="quiet-strip" aria-hidden="true">
																{plug.quiet.flatMap((range) =>
																	quietSegments(range).map((segment) => (
																		<span
																			key={`${range.key}-${segment.left}`}
																			className="quiet-band"
																			style={{
																				left: `${segment.left}%`,
																				width: `${segment.width}%`,
																			}}
																		/>
																	)),
																)}
																{[0, 6, 12, 18, 24].map((hour) => (
																	<span
																		key={hour}
																		className="quiet-tick"
																		style={{ left: `${(hour / 24) * 100}%` }}
																	>
																		{pad(hour)}
																	</span>
																))}
															</div>

															<ul className="quiet-list">
																{plug.quiet.map((range) => (
																	<li
																		key={range.key}
																		className="quiet-range"
																		aria-invalid={quietInvalid(range)}
																	>
																		<input
																			className="mono"
																			type="time"
																			value={range.start}
																			disabled={plug.removed}
																			aria-label="Quiet from"
																			onChange={(e) =>
																				updateQuiet(
																					plug,
																					plug.quiet.map((entry) =>
																						entry.key === range.key
																							? {
																									...entry,
																									start: e.target.value,
																								}
																							: entry,
																					),
																				)
																			}
																		/>
																		<span className="quiet-to">to</span>
																		<input
																			className="mono"
																			type="time"
																			value={range.end}
																			disabled={plug.removed}
																			aria-label="Quiet until"
																			onChange={(e) =>
																				updateQuiet(
																					plug,
																					plug.quiet.map((entry) =>
																						entry.key === range.key
																							? {
																									...entry,
																									end: e.target.value,
																								}
																							: entry,
																					),
																				)
																			}
																		/>
																		{range.end &&
																			range.start &&
																			range.end < range.start && (
																				<span className="quiet-overnight">
																					overnight
																				</span>
																			)}
																		<button
																			className="quiet-remove"
																			type="button"
																			disabled={plug.removed}
																			aria-label={`Remove ${range.start} to ${range.end}`}
																			title="Remove"
																			onClick={() =>
																				updateQuiet(
																					plug,
																					plug.quiet.filter(
																						(entry) => entry.key !== range.key,
																					),
																				)
																			}
																		>
																			<svg
																				viewBox="0 0 24 24"
																				fill="currentColor"
																				aria-hidden="true"
																			>
																				<path d="M6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6 6.4 5Z" />
																			</svg>
																		</button>
																	</li>
																))}
															</ul>
														</>
													)}
												</div>

												{line && (
													<div className={`plug-status tone-${line.tone}`}>
														<span
															className="plug-status-dot"
															aria-hidden="true"
														/>
														<span className="plug-status-text">
															{line.text}
														</span>
														<button
															className={`plug-restart${armedPlug === plug.id ? " armed" : ""}`}
															type="button"
															disabled={
																edited ||
																cyclePlug.isPending ||
																Boolean(
																	plugStatus.data?.[plug.id as number]?.busy,
																)
															}
															title={
																edited
																	? "Save first, restarting uses the saved settings"
																	: "Turns it off for 10 seconds, then back on"
															}
															onClick={() => restartPlug(plug.id as number)}
														>
															{armedPlug === plug.id
																? "Tap to confirm"
																: "Restart now"}
														</button>
													</div>
												)}
											</div>

											<button
												className={`icon-btn${plug.removed ? "" : " icon-btn--danger"}`}
												type="button"
												aria-label={
													plug.removed
														? `Keep ${plug.name}`
														: `Remove ${plug.name || "plug"}`
												}
												title={plug.removed ? "Keep" : "Remove"}
												onClick={() => removePlug(plug)}
											>
												{plug.removed ? (
													<svg
														viewBox="0 0 24 24"
														fill="currentColor"
														aria-hidden="true"
													>
														<path d="M12.5 8H7.8l2.6-2.6L9 4 4 9l5 5 1.4-1.4L7.8 10h4.7a4.5 4.5 0 0 1 0 9H8v2h4.5a6.5 6.5 0 0 0 0-13Z" />
													</svg>
												) : (
													<svg
														viewBox="0 0 24 24"
														fill="currentColor"
														aria-hidden="true"
													>
														<path d="M9 3h6l1 2h4v2H4V5h4l1-2ZM6 9h12l-.9 11.1A2 2 0 0 1 15.1 22H8.9a2 2 0 0 1-2-1.9L6 9Zm4 3v7h1.5v-7H10Zm2.5 0v7H14v-7h-1.5Z" />
													</svg>
												)}
											</button>
										</li>
									);
								})}
							</ol>
						) : (
							<p className="hint">No plugs yet. Add one with its IP address.</p>
						)}

						<hr className="rule" />

						<div className="section-head">
							<h3>Server alerts</h3>
							<span className="alert-toggle">
								<button
									className={`rocker${draft.alerts.enabled ? " on" : ""}`}
									type="button"
									role="switch"
									aria-checked={draft.alerts.enabled}
									aria-label="Server alerts"
									onClick={() =>
										updateAlerts({ enabled: !draft.alerts.enabled })
									}
								>
									<i />
								</button>
							</span>
						</div>
						<p className="hint">
							The server checks its health every 5 minutes. A warning turns the
							bulb purple, anything critical turns it red, and it switches off
							again once everything is clear.
						</p>

						<fieldset
							className={`alert-picker${draft.alerts.enabled ? "" : " is-off"}`}
							aria-label="Alert bulb"
						>
							{alertCandidates.length ? (
								alertCandidates.map((bulb) => (
									<button
										key={bulb.key}
										className={`alert-bulb${draft.alerts.bulbId === bulb.id ? " active" : ""}`}
										type="button"
										aria-pressed={draft.alerts.bulbId === bulb.id}
										disabled={!draft.alerts.enabled}
										onClick={() => updateAlerts({ bulbId: bulb.id ?? null })}
									>
										<span className="alert-bulb-glyph" aria-hidden="true" />
										{bulb.name || "Unnamed"}
									</button>
								))
							) : (
								<span className="hint">
									Save a bulb first to use it for alerts.
								</span>
							)}
						</fieldset>

						<div className={`alert-now tone-${alertState.tone}`}>
							<span className="alert-now-dot" aria-hidden="true" />
							<span>{alertState.label}</span>
						</div>
					</div>
				)}

				<footer className="settings-foot">
					<output
						className={`settings-status${save.isError ? " is-error" : ""}${saved && !dirty ? " is-saved" : ""}`}
					>
						{status}
					</output>
					<button
						className="ghost-btn"
						type="button"
						disabled={!dirty || save.isPending}
						onClick={discard}
					>
						Discard
					</button>
					<button
						className="accent-btn"
						type="button"
						disabled={!dirty || invalid || save.isPending}
						onClick={submit}
					>
						Save
					</button>
				</footer>
			</section>
		</>
	);
}
