import { type FormEvent, useState } from "react";
import {
	MAX_WINDOWS,
	type TSchedule,
	type TWindow,
} from "../../shared/protocol";
import type { VaultClient } from "../lib/api";
import { formatTime } from "../lib/format";
import { Icon } from "./Icons";

type TProps = {
	client: VaultClient;
	schedule: TSchedule;
	onChange: () => void;
};

export function Schedule({ client, schedule, onChange }: TProps) {
	const [start, setStart] = useState("00:10");
	const [end, setEnd] = useState("00:25");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [asked, setAsked] = useState(false);

	const save = async (windows: TWindow[]) => {
		setError("");
		setBusy(true);
		try {
			await client.call("setSchedule", { windows });
			onChange();
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : "Could not save");
		} finally {
			setBusy(false);
		}
	};

	const add = (event: FormEvent) => {
		event.preventDefault();
		void save([...schedule.windows, { start, end }]);
	};

	const state =
		schedule.windows.length === 0
			? "Checked all day"
			: schedule.open
				? "Checking now"
				: schedule.nextOpen
					? `Next check at ${formatTime(schedule.nextOpen)}`
					: "Waiting";

	return (
		<section className="panel glass schedule">
			<div className="queue-head">
				<h2>
					Import{" "}
					<span className={`count${schedule.open ? " state--importing" : ""}`}>
						{state}
					</span>
				</h2>
				<button
					className="btn btn--ghost btn--sm"
					type="button"
					onClick={async () => {
						setAsked(true);
						await client.call("checkNow").catch(() => {});
						onChange();
						setTimeout(() => setAsked(false), 3000);
					}}
					title="Checks the inbox once now, whatever the hours say"
				>
					<Icon name="repeat" />
					{asked ? "Checking" : "Check now"}
				</button>
			</div>
			<p className="dialog-text">
				{schedule.windows.length === 0
					? "The inbox is checked every 10 seconds, all day. Add a window to only check during set hours, for example just after FolderSync runs."
					: "The inbox is only checked during these windows, every 10 seconds while one is open. Remove them all to check all day. Sealed uploads and the Android copy still import whenever the vault is unlocked."}
			</p>
			<div className="windows">
				{schedule.windows.map((window, index) => (
					<span className="window" key={`${window.start}-${window.end}`}>
						{window.start} to {window.end}
						{window.end < window.start && <i>overnight</i>}
						<button
							type="button"
							aria-label={`Remove ${window.start} to ${window.end}`}
							disabled={busy}
							onClick={() =>
								void save(
									schedule.windows.filter((_, other) => other !== index),
								)
							}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" />
							</svg>
						</button>
					</span>
				))}
				{schedule.windows.length < MAX_WINDOWS && (
					<form className="window-add" onSubmit={add}>
						<input
							type="time"
							value={start}
							onChange={(event) => setStart(event.target.value)}
							aria-label="Window start"
							required
						/>
						<span>to</span>
						<input
							type="time"
							value={end}
							onChange={(event) => setEnd(event.target.value)}
							aria-label="Window end"
							required
						/>
						<button
							className="btn btn--ghost btn--sm"
							type="submit"
							disabled={busy}
						>
							Add
						</button>
					</form>
				)}
			</div>
			{error && <p className="dialog-error">{error}</p>}
			<p className="activity-line">
				Server time, {schedule.timezone}.{" "}
				{schedule.lastCheck
					? `Last checked at ${formatTime(schedule.lastCheck)}.`
					: "Not checked since the service started."}
			</p>
		</section>
	);
}
