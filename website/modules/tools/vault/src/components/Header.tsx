import { useEffect, useState } from "react";
import { IDLE_MAX, IDLE_MIN, IDLE_STEP } from "../../shared/protocol";
import { Icon } from "./Icons";

type TProps = {
	busy: boolean;
	idleMinutes: number;
	idleDefault: number;
	lockIn: number | null;
	onIdle: (minutes: number) => void;
	onPassword: () => void;
	onLock: () => void;
	onTheme: () => void;
};

export function Mark({ open }: { open: boolean }) {
	return (
		<span className={`mark${open ? " is-open" : ""}`} aria-hidden="true">
			<svg viewBox="0 0 40 40" aria-hidden="true">
				<path className="mark-shackle" d="M13 18v-5a7 7 0 0 1 14 0v5" />
				<rect className="mark-body" x="8" y="18" width="24" height="17" rx="5" />
				<circle className="mark-core" cx="20" cy="26.5" r="2.6" />
			</svg>
		</span>
	);
}

export function ThemeButton({ onTheme }: { onTheme: () => void }) {
	return (
		<button className="round-btn" type="button" onClick={onTheme} aria-label="Switch theme" title="Switch theme">
			<Icon name="sun" className="sun" />
			<Icon name="moon" className="moon" />
		</button>
	);
}

function clock(ms: number) {
	const seconds = Math.ceil(ms / 1000);
	const hours = Math.floor(seconds / 3600);
	const rest = `${String(Math.floor((seconds % 3600) / 60)).padStart(hours ? 2 : 1, "0")}:${String(seconds % 60).padStart(2, "0")}`;
	return hours ? `${hours}:${rest}` : rest;
}

// Counts down between status polls from when the last one arrived, so the browser's clock doesn't matter
function Countdown({ lockIn, idleMinutes, idleDefault, onIdle }: Pick<TProps, "lockIn" | "idleMinutes" | "idleDefault" | "onIdle">) {
	const [now, setNow] = useState(Date.now());
	const [deadline, setDeadline] = useState<number | null>(null);

	useEffect(() => {
		setDeadline(lockIn === null ? null : Date.now() + lockIn);
	}, [lockIn]);

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	const left = deadline === null ? null : Math.max(deadline - now, 0);
	const changed = idleMinutes - idleDefault;

	return (
		<span className="brand-sub idle">
			<span className={`idle-clock${left !== null && left < 60 * 1000 ? " is-soon" : ""}`}>
				{left === null ? `Locks after ${idleMinutes} min without use` : `Locks in ${clock(left)}`}
			</span>
			<span className="idle-limit" title={`Every unlock starts at ${idleDefault} min`}>
				{idleMinutes} min idle{changed !== 0 && <i>{changed > 0 ? `+${changed}` : changed}</i>}
			</span>
			<span className="idle-steps">
				<button type="button" disabled={idleMinutes <= IDLE_MIN} onClick={() => onIdle(idleMinutes - IDLE_STEP)} aria-label={`${IDLE_STEP} minutes less`}>
					−{IDLE_STEP}
				</button>
				<button type="button" disabled={idleMinutes >= IDLE_MAX} onClick={() => onIdle(idleMinutes + IDLE_STEP)} aria-label={`${IDLE_STEP} minutes more`}>
					+{IDLE_STEP}
				</button>
			</span>
		</span>
	);
}

export function Header({ busy, idleMinutes, idleDefault, lockIn, onIdle, onPassword, onLock, onTheme }: TProps) {
	return (
		<header className="header glass">
			<div className="brand">
				<Mark open />
				<div>
					<h1>Vault</h1>
					<Countdown lockIn={lockIn} idleMinutes={idleMinutes} idleDefault={idleDefault} onIdle={onIdle} />
				</div>
			</div>

			<div className="header-side">
				<span className={`live${busy ? " is-busy" : ""}`}>
					<span className="dot" />
					{busy ? "Working" : "Unlocked"}
				</span>
				<button className="round-btn" type="button" onClick={onPassword} aria-label="Change password" title="Change password">
					<Icon name="key" />
				</button>
				<ThemeButton onTheme={onTheme} />
				<button className="btn btn--ghost" type="button" onClick={onLock}>
					<Icon name="lock" />
					Lock
				</button>
			</div>
		</header>
	);
}
