import { useEffect, useRef, useState } from "react";
import type { TMirrorStatus } from "../../shared/protocol";
import type { VaultClient } from "../lib/api";
import { formatBytes, formatTime } from "../lib/format";
import { Icon } from "./Icons";

type TProps = { client: VaultClient; mirror: TMirrorStatus; onChange: () => void };

export function Mirror({ client, mirror, onChange }: TProps) {
	const [error, setError] = useState("");
	const [armed, setArmed] = useState(false);
	const disarm = useRef<ReturnType<typeof setTimeout>>();
	useEffect(() => () => clearTimeout(disarm.current), []);

	const call = async (method: string, params?: Record<string, unknown>) => {
		setError("");
		try {
			await client.call(method, params);
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : "Failed");
		}
		onChange();
	};

	const live = mirror.running;
	const last = mirror.lastCompleted;
	const success = mirror.lastSuccess;
	const state = live ? "importing" : mirror.held ? "waiting" : last && !last.ok ? "failed" : "";
	const chip = live ? live.phase : mirror.held ? "Waiting for you" : !last ? "Not synced yet" : last.ok ? "Synced" : "Failed";

	const approve = () => {
		if (!armed) {
			setArmed(true);
			disarm.current = setTimeout(() => setArmed(false), 6000);
			return;
		}
		clearTimeout(disarm.current);
		setArmed(false);
		void call("mirrorSync", { approve: mirror.held?.deletes });
	};

	return (
		<section className="panel glass mirror">
			<div className="queue-head">
				<h2>
					Backup mirror <span className={`count${state ? ` state--${state}` : ""}`}>{chip}</span>
				</h2>
				{live ? (
					<button className="btn btn--ghost btn--sm" type="button" disabled={live.cancelled} onClick={() => void call("mirrorCancel")}>
						Stop
					</button>
				) : (
					<button className="btn btn--ghost btn--sm" type="button" onClick={() => void call("mirrorSync")} title="Copies anything new or changed to the backup drive">
						<Icon name="repeat" />
						Sync now
					</button>
				)}
			</div>
			<p className="dialog-text">
				The encrypted vault folder is copied to {mirror.dest} every {mirror.everyHours} hours, locked or not. Files removed from the vault are removed from the copy too.
			</p>
			{live && (
				<div className="job">
					<span className="job-kind">{live.checksum ? "Checking every byte" : "Syncing"}</span>
					<span className="job-name">
						{live.plan
							? `${live.plan.files.toLocaleString()} to copy, ${formatBytes(live.plan.bytes)}${live.plan.deletes ? `, ${live.plan.deletes.toLocaleString()} to remove` : ""}`
							: live.phase}
					</span>
					<div className="bar bar--live">
						<span style={{ width: `${live.progress?.percent ?? 0}%` }} />
					</div>
					<span className="seed-meta">
						{live.progress ? `${live.progress.percent}%, ${live.progress.rate}, ${live.progress.eta} left` : "Starting"}
					</span>
				</div>
			)}
			{mirror.held && !live && (
				<div className="mirror-held">
					<p>
						The vault no longer has {mirror.held.deletes.toLocaleString()} files the backup still holds. That is more than the {mirror.held.limit.toLocaleString()}{" "}
						the mirror removes on its own, so nothing was changed. Approve it only if you deleted that much on purpose.
					</p>
					<button className={`btn btn--sm ${armed ? "btn--danger" : "btn--ghost"}`} type="button" onClick={approve}>
						{armed ? `Delete ${mirror.held.deletes.toLocaleString()} from the backup` : "Review deletes"}
					</button>
				</div>
			)}
			{error && <p className="dialog-error">{error}</p>}
			{last && !last.ok && !mirror.held && !live && <p className="activity-line is-bad">Last sync failed: {last.error}</p>}
			<p className="activity-line">
				{success
					? `Synced at ${formatTime(success.finishedAt)}${success.stats ? `, ${success.stats.transferred.toLocaleString()} copied${success.stats.deleted ? `, ${success.stats.deleted.toLocaleString()} removed` : ""}, ${formatBytes(success.stats.totalBytes)} in all` : ""}.`
					: "No sync has finished yet."}{" "}
				{!live && `Next at ${formatTime(mirror.nextScheduled)}.`}
			</p>
		</section>
	);
}
