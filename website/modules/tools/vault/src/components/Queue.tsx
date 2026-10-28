import { type CSSProperties, useEffect, useState } from "react";
import type { TEvent, TInboxFile, TMirror } from "../../shared/protocol";
import type { VaultClient } from "../lib/api";
import { formatBytes, formatDate, formatTime } from "../lib/format";
import { Icon, kindOf } from "./Icons";

const INBOX_STATE: Record<TInboxFile["state"], string> = {
	uploading: "Arriving",
	ready: "Next up",
	failing: "Failing",
};

const RESULT: Record<TEvent["result"], string> = {
	imported: "Imported",
	duplicate: "Already in the vault",
	sealed: "Sealed",
	failed: "Failed",
	copied: "Copied",
};

type TTab = "inbox" | "recent";

export function Queue({ client, refreshKey }: { client: VaultClient; refreshKey: number }) {
	const [tab, setTab] = useState<TTab>("inbox");
	const [inbox, setInbox] = useState<TInboxFile[]>([]);
	const [events, setEvents] = useState<TEvent[]>([]);
	const [mirror, setMirror] = useState("");
	const [mirroring, setMirroring] = useState(false);

	const mirrorFolders = async () => {
		setMirroring(true);
		try {
			const result = await client.call<TMirror>("mirrorFolders");
			const parts = [
				result.created.length === 0
					? "No new folders"
					: `Created ${result.created.length} folder${result.created.length === 1 ? "" : "s"}`,
			];
			if (result.existing) {
				parts.push(`${result.existing} already there`);
			}
			if (result.blocked.length) {
				parts.push(`${result.blocked.length} blocked by a file with the same name`);
			}
			setMirror(`${parts.join(", ")}.`);
		} catch (failure) {
			setMirror(failure instanceof Error ? failure.message : "Could not mirror the folders");
		} finally {
			setMirroring(false);
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey moves with every status poll, so both lists stay live
	useEffect(() => {
		let live = true;
		void Promise.all([
			client.call<TInboxFile[]>("inbox"),
			client.call<TEvent[]>("events", { limit: 100 }),
		])
			.then(([files, recent]) => {
				if (live) {
					setInbox(files);
					setEvents(recent);
				}
			})
			.catch(() => {});
		return () => {
			live = false;
		};
	}, [client, refreshKey]);

	const rows = tab === "inbox" ? inbox : events;

	return (
		<section className="panel glass queue-panel">
			<div className="queue-head">
				<h2>
					{tab === "inbox" ? "Inbox" : "Recent"}
					<span className="count">{rows.length}</span>
				</h2>
				<div className="queue-tools">
					{tab === "inbox" && (
						<button
							className="btn btn--ghost btn--sm"
							type="button"
							disabled={mirroring}
							onClick={() => void mirrorFolders()}
							title="Creates each top-level folder of Android in the inbox, nothing is ever deleted"
						>
							<Icon name="folder" />
							{mirroring ? "Mirroring" : "Mirror folders"}
						</button>
					)}
					<div className="switch" role="tablist">
						<button
							type="button"
							role="tab"
							aria-selected={tab === "inbox"}
							className={tab === "inbox" ? "is-on" : ""}
							onClick={() => setTab("inbox")}
						>
							Inbox
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={tab === "recent"}
							className={tab === "recent" ? "is-on" : ""}
							onClick={() => setTab("recent")}
						>
							Recent
						</button>
					</div>
				</div>
			</div>
			{tab === "inbox" && mirror && <p className="activity-line queue-note">{mirror}</p>}
			{rows.length === 0 && (
				<p className="empty">
					{tab === "inbox"
						? "The inbox is empty, everything is in the vault."
						: "Nothing has happened since the service started."}
				</p>
			)}
			<ul className="lines">
				{tab === "inbox"
					? inbox.map((file, index) => (
							<li
								key={file.path}
								className={`line is-${file.state}`}
								style={{ "--i": Math.min(index, 24) } as CSSProperties}
							>
								<Icon name={kindOf(file.path)} />
								<span className="line-name" title={file.path}>
									{file.path}
								</span>
								<span className="line-meta">{formatBytes(file.size)}</span>
								<span className="line-tag">{INBOX_STATE[file.state]}</span>
							</li>
						))
					: events.map((event, index) => (
							<li
								key={`${event.at}-${event.name}-${index}`}
								className={`line is-${event.result}`}
								style={{ "--i": Math.min(index, 24) } as CSSProperties}
							>
								<Icon name={kindOf(event.name)} />
								<span
									className="line-name"
									title={event.savedAs ? `Saved as ${event.savedAs}` : event.name}
								>
									{event.name}
								</span>
								<span className="line-meta" title={formatDate(event.at)}>
									{formatBytes(event.size)}, {formatTime(event.at)}
								</span>
								<span className="line-tag">{RESULT[event.result]}</span>
							</li>
						))}
			</ul>
		</section>
	);
}
