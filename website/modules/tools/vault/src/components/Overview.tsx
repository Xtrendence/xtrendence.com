import type { CSSProperties } from "react";
import type { TActivity, TJob, TStorage } from "../../shared/protocol";
import { formatBytes, formatDate, formatTime } from "../lib/format";
import { Icon } from "./Icons";

const STATE: Record<TActivity["state"], string> = {
	idle: "Idle",
	importing: "Importing",
	sealing: "Sealing",
	copying: "Copying",
	paused: "Paused",
	waiting: "Outside import hours",
};

const KIND: Record<TJob["kind"], string> = {
	inbox: "Importing from the inbox",
	pending: "Importing a sealed upload",
	seed: "Copying from the Android folder",
	seal: "Sealing while locked",
};

const STAGE: Record<TJob["stage"], string> = {
	hashing: "Comparing checksums",
	copying: "Copying",
	verifying: "Verifying the copy",
	sealing: "Encrypting",
	decrypting: "Decrypting",
	shredding: "Shredding the original",
};

function Job({ job }: { job: TJob }) {
	const fraction = job.total > 0 ? Math.min(1, job.bytes / job.total) : 0;
	return (
		<div className="job">
			<span className="job-kind">{KIND[job.kind]}</span>
			<span className="job-name" title={job.name}>
				{job.name}
			</span>
			<div className="bar bar--live">
				<span style={{ width: `${(job.stage === "shredding" ? 1 : fraction) * 100}%` }} />
			</div>
			<span className="seed-meta">
				{STAGE[job.stage]}
				{job.stage !== "shredding" && `, ${formatBytes(job.bytes)} of ${formatBytes(job.total)}`}
			</span>
		</div>
	);
}

const share = (part: number, total: number) => `${total > 0 ? Math.min(100, (part / total) * 100) : 0}%`;

export function Storage({ storage }: { storage: TStorage }) {
	const used = storage.driveTotal - storage.driveFree;
	const vault = storage.vaultBytes ?? 0;
	const other = Math.max(0, used - vault);

	return (
		<section className="panel glass storage">
			<h2>
				Storage <span className="count">{formatBytes(storage.driveTotal)} drive</span>
			</h2>
			<div className="figure">
				<strong>{storage.vaultBytes === null ? "Measuring" : formatBytes(vault)}</strong>
				<span>in the vault, {formatBytes(storage.driveFree)} left</span>
			</div>
			<div className="meter" role="img" aria-label="Drive usage">
				<span className="meter-vault" style={{ width: share(vault, storage.driveTotal) }} />
				<span className="meter-other" style={{ width: share(other, storage.driveTotal) }} />
			</div>
			<ul className="legend">
				<li>
					<i className="swatch swatch--vault" />
					Vault <b>{formatBytes(vault)}</b>
				</li>
				<li>
					<i className="swatch swatch--other" />
					Other files <b>{formatBytes(other)}</b>
				</li>
				<li>
					<i className="swatch" />
					Free <b>{formatBytes(storage.driveFree)}</b>
				</li>
			</ul>
			<div className="queues">
				<div className="queue">
					<span className="queue-label">Inbox</span>
					<span className="queue-value">{storage.inboxFiles}</span>
					<span className="queue-meta">{formatBytes(storage.inboxBytes)} waiting</span>
				</div>
				<div className="queue">
					<span className="queue-label">Sealed</span>
					<span className="queue-value">{storage.pendingFiles}</span>
					<span className="queue-meta">{formatBytes(storage.pendingBytes)} to import</span>
				</div>
			</div>
		</section>
	);
}

export function Activity({ activity, onSeed }: { activity: TActivity; onSeed: () => void }) {
	const seed = activity.seed;
	const progress = seed?.totalBytes ? seed.bytes / seed.totalBytes : 0;

	return (
		<section className="panel glass activity">
			<h2>
				Activity <span className={`count state state--${activity.state}`}>{STATE[activity.state]}</span>
			</h2>
			<div className="stats">
				<div>
					<b>{activity.imported}</b>
					<span>Imported</span>
				</div>
				<div>
					<b>{activity.duplicates}</b>
					<span>Already there</span>
				</div>
				<div>
					<b>{activity.sealed}</b>
					<span title="Sealed while the vault was locked">Sealed</span>
				</div>
				<div className={activity.failed ? "is-bad" : ""}>
					<b>{activity.failed}</b>
					<span>Failed</span>
				</div>
			</div>
			{activity.current && <Job job={activity.current} />}
			<p className="activity-line">
				{activity.lastImport ? `Last import at ${formatTime(activity.lastImport)}` : "Nothing imported since the service started"}
			</p>
			{activity.lastError && <p className="activity-line is-bad">Last error: {activity.lastError}</p>}
			{seed && (
				<div className="seed">
					<div className="seed-top">
						<span className="seed-title">
							<Icon name="shield" />
							Android folder copy
						</span>
						{seed.done && (
							<button className="btn btn--ghost btn--sm" type="button" onClick={onSeed} title="Copies anything new or changed, the folder is never modified">
								<Icon name="repeat" />
								Copy again
							</button>
						)}
					</div>
					<div className="bar">
						<span style={{ width: `${(seed.done ? 1 : progress) * 100}%` } as CSSProperties} />
					</div>
					<span className="seed-meta">
						{seed.done
							? `Copied ${seed.finishedAt ? formatDate(seed.finishedAt) : ""}, the original is untouched`
							: seed.totalFiles === null
								? "Counting files"
								: `${seed.files} of ${seed.totalFiles} files, ${formatBytes(seed.bytes)} of ${formatBytes(seed.totalBytes ?? 0)}`}
					</span>
				</div>
			)}
		</section>
	);
}
