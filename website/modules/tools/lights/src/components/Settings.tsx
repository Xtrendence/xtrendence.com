import { useEffect, useMemo, useRef, useState } from "react";
import type { TAlertLevel, TSettings } from "../../shared/types";
import { useSaveSettings, useSettings } from "../hooks/useSettings";

type TDraftBulb = {
	key: string;
	id?: number;
	name: string;
	ip: string;
	mac: string;
	removed: boolean;
};

type TDraftHost = { key: string; value: string };

type TDraft = {
	bulbs: TDraftBulb[];
	hosts: TDraftHost[];
	alerts: TSettings["alerts"];
};

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
	};
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
	const panel = useRef<HTMLElement>(null);

	const [draft, setDraft] = useState<TDraft | null>(null);
	const [saved, setSaved] = useState(false);

	// Structural sharing keeps the same reference on an identical refetch, so
	// edits survive closing and reopening unless the file changed underneath
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
					<h2>Bulbs and sensor</h2>
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
