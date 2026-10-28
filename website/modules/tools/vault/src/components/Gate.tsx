import { type FormEvent, useEffect, useRef, useState } from "react";
import { MIN_PASSWORD } from "../../shared/protocol";
import { Mark, ThemeButton } from "./Header";

type TProps = {
	exists: boolean;
	unlocked: boolean;
	fingerprint: string;
	onUnlock: (password: string) => Promise<void>;
	onCreate: (password: string) => Promise<void>;
	onTheme: () => void;
};

export function Gate({ exists, unlocked, fingerprint, onUnlock, onCreate, onTheme }: TProps) {
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const [working, setWorking] = useState(false);
	const field = useRef<HTMLInputElement>(null);

	useEffect(() => {
		field.current?.focus();
	}, []);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		setError("");
		if (!exists) {
			if (password.length < MIN_PASSWORD) {
				setError(`Use at least ${MIN_PASSWORD} characters`);
				return;
			}
			if (password !== confirm) {
				setError("The passwords do not match");
				return;
			}
		}
		setWorking(true);
		try {
			await (exists ? onUnlock(password) : onCreate(password));
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : "Something went wrong");
			setWorking(false);
		}
	};

	const title = !exists ? "Create the vault" : unlocked ? "Open the vault" : "Unlock the vault";
	const text = !exists
		? "Choose a long password. It cannot be recovered without the recovery key shown next, so keep both safe."
		: unlocked
			? "It is already unlocked on another device. Enter the password to see it here."
			: "Everything inside stays encrypted until the password is entered. New uploads are sealed while it is locked.";

	return (
		<main className="gate">
			<div className="gate-theme">
				<ThemeButton onTheme={onTheme} />
			</div>
			<form className="gate-card glass" onSubmit={submit}>
				<Mark open={false} />
				<span className="eyebrow">{exists ? (unlocked ? "Unlocked elsewhere" : "Locked") : "First run"}</span>
				<h1>{title}</h1>
				<p className="gate-text">{text}</p>
				<input
					className="field-input"
					type="password"
					autoComplete={exists ? "current-password" : "new-password"}
					placeholder="Password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					disabled={working}
					ref={field}
				/>
				{!exists && (
					<input
						className="field-input"
						type="password"
						autoComplete="new-password"
						placeholder="Password again"
						value={confirm}
						onChange={(event) => setConfirm(event.target.value)}
						disabled={working}
					/>
				)}
				{error && <p className="dialog-error">{error}</p>}
				<div className="gate-foot">
					<span className="fingerprint" title="The server's key. It should stay the same on every visit">
						{fingerprint}
					</span>
					<button className="btn btn--accent" type="submit" disabled={working || !password}>
						{working ? (exists ? "Unlocking" : "Creating") : exists ? "Unlock" : "Create"}
					</button>
				</div>
			</form>
		</main>
	);
}
