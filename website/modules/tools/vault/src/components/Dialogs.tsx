import { type FormEvent, useState } from "react";
import { MIN_PASSWORD } from "../../shared/protocol";
import { copyText } from "../lib/format";
import { Dialog } from "./Dialog";
import { Icon } from "./Icons";

export function PasswordDialog({ onSubmit, onClose }: { onSubmit: (current: string, next: string) => Promise<void>; onClose: () => void }) {
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const [working, setWorking] = useState(false);
	const [done, setDone] = useState(false);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		setError("");
		if (next.length < MIN_PASSWORD) {
			setError(`Use at least ${MIN_PASSWORD} characters`);
			return;
		}
		if (next !== confirm) {
			setError("The new passwords do not match");
			return;
		}
		setWorking(true);
		try {
			await onSubmit(current, next);
			setDone(true);
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : "Something went wrong");
		} finally {
			setWorking(false);
		}
	};

	if (done) {
		return (
			<Dialog eyebrow="Password" title="Password changed" onClose={onClose}>
				<p className="dialog-text">
					The vault now opens with the new password. The recovery key is unchanged and still works.
				</p>
				<div className="dialog-foot">
					<button className="btn btn--accent" type="button" onClick={onClose}>
						Done
					</button>
				</div>
			</Dialog>
		);
	}

	return (
		<Dialog eyebrow="Password" title="Change the vault password" onClose={working ? undefined : onClose}>
			<form className="stack" onSubmit={submit}>
				<p className="dialog-text">Only the key that protects the vault is re-wrapped, so this takes a moment whatever its size.</p>
				<input
					className="field-input"
					type="password"
					autoComplete="current-password"
					placeholder="Current password"
					value={current}
					onChange={(event) => setCurrent(event.target.value)}
				/>
				<input
					className="field-input"
					type="password"
					autoComplete="new-password"
					placeholder="New password"
					value={next}
					onChange={(event) => setNext(event.target.value)}
				/>
				<input
					className="field-input"
					type="password"
					autoComplete="new-password"
					placeholder="New password again"
					value={confirm}
					onChange={(event) => setConfirm(event.target.value)}
				/>
				{error && <p className="dialog-error">{error}</p>}
				<div className="dialog-foot">
					<button className="btn btn--ghost" type="button" onClick={onClose} disabled={working}>
						Cancel
					</button>
					<button className="btn btn--accent" type="submit" disabled={working || !current || !next}>
						{working ? "Changing" : "Change"}
					</button>
				</div>
			</form>
		</Dialog>
	);
}

export function RecoveryDialog({ recoveryKey, onClose }: { recoveryKey: string; onClose: () => void }) {
	const [saved, setSaved] = useState(false);
	const [copied, setCopied] = useState(false);

	return (
		<Dialog eyebrow="Shown once" title="Your recovery key" wide>
			<p className="dialog-text">
				This opens the vault if the password is ever lost. It is not stored anywhere and will not be shown again. Keep copies offline in more
				than one safe place.
			</p>
			<code className="recovery">{recoveryKey}</code>
			<p className="dialog-text">
				To use it: gocryptfs -masterkey=&lt;key&gt; on the encrypted folder, then set a new password with gocryptfs -passwd -masterkey.
			</p>
			<label className="check">
				<input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />I have stored the recovery key safely
			</label>
			<div className="dialog-foot">
				<button
					className="btn btn--ghost"
					type="button"
					onClick={async () => {
						setCopied(await copyText(recoveryKey));
					}}
				>
					<Icon name="copy" />
					{copied ? "Copied" : "Copy"}
				</button>
				<button className="btn btn--accent" type="button" onClick={onClose} disabled={!saved}>
					Continue
				</button>
			</div>
		</Dialog>
	);
}
