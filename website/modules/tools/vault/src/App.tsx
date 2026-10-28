import { useCallback, useEffect, useRef, useState } from "react";
import type { TStatus } from "../shared/protocol";
import { Explorer } from "./components/Explorer";
import { Gate } from "./components/Gate";
import { Header } from "./components/Header";
import { PasswordDialog, RecoveryDialog } from "./components/Dialogs";
import { Activity, Storage } from "./components/Overview";
import { Queue } from "./components/Queue";
import { Mirror } from "./components/Mirror";
import { Schedule } from "./components/Schedule";
import { KeyChanged, pinKey, VaultClient } from "./lib/api";
import { nativeCrypto } from "./lib/crypto";

const client = new VaultClient();

function toggleTheme() {
	const light = !document.documentElement.classList.contains("light");
	document.documentElement.classList.toggle("light", light);
	document.documentElement.classList.toggle("dark", !light);
	try {
		localStorage.setItem("theme", light ? "light" : "dark");
	} catch {}
}

type TProblem = { kind: "offline"; message: string } | { kind: "key"; error: KeyChanged };

export function App() {
	const [status, setStatus] = useState<TStatus | null>(null);
	const [problem, setProblem] = useState<TProblem | null>(null);
	const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
	const [changing, setChanging] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);
	const [tick, setTick] = useState(0);
	const lastImport = useRef<number | null>(null);

	const refresh = useCallback(async () => {
		try {
			const next = await client.call<TStatus>("status");
			setStatus(next);
			setProblem(null);
			setTick((value) => value + 1);
			// A new import refreshes the open folder
			const imported = next.activity?.lastImport ?? null;
			if (imported !== lastImport.current) {
				lastImport.current = imported;
				setRefreshKey((key) => key + 1);
			}
		} catch (error) {
			setProblem(
				error instanceof KeyChanged
					? { kind: "key", error }
					: { kind: "offline", message: error instanceof Error ? error.message : "The vault is not reachable" },
			);
		}
	}, []);

	useEffect(() => {
		void refresh();
		const timer = setInterval(() => void refresh(), status?.authed ? 4000 : 10000);
		return () => clearInterval(timer);
	}, [refresh, status?.authed]);

	if (problem?.kind === "key") {
		return (
			<main className="gate">
				<div className="gate-card glass gate-card--warn">
					<span className="eyebrow">Warning</span>
					<h1>The server's key changed</h1>
					<p className="gate-text">
						This browser pinned key {problem.error.pinned}, the server now offers {problem.error.offered}. That happens after the vault's state
						folder is recreated, otherwise something on the network may be intercepting. Do not enter the password unless you expected this.
					</p>
					<div className="gate-foot">
						<span />
						<button
							className="btn btn--danger"
							type="button"
							onClick={() => {
								pinKey(problem.error.pub);
								void refresh();
							}}
						>
							Trust the new key
						</button>
					</div>
				</div>
			</main>
		);
	}

	if (!status) {
		return (
			<main className="gate">
				<div className="gate-card glass">
					<span className="eyebrow">{problem ? "Offline" : "Connecting"}</span>
					<h1>{problem ? "The vault is not reachable" : "Opening a secure channel"}</h1>
					{problem && <p className="gate-text">{problem.message}</p>}
				</div>
			</main>
		);
	}

	if (!status.authed) {
		return (
			<Gate
				exists={status.exists}
				unlocked={status.unlocked}
				fingerprint={client.fingerprint}
				onTheme={toggleTheme}
				onUnlock={async (password) => {
					await client.call("unlock", { password });
					await refresh();
				}}
				onCreate={async (password) => {
					const { recoveryKey: key } = await client.call<{ recoveryKey: string }>("create", { password });
					setRecoveryKey(key);
					await refresh();
				}}
			/>
		);
	}

	const busy = status.activity ? status.activity.state !== "idle" && status.activity.state !== "paused" : false;

	return (
		<div className="app">
			<Header
				busy={busy}
				idleMinutes={status.idleMinutes}
				idleDefault={status.idleDefault}
				lockIn={status.lockIn ?? null}
				onIdle={async (minutes) => {
					await client.call("setIdleTimeout", { minutes }).catch(() => {});
					await refresh();
				}}
				onPassword={() => setChanging(true)}
				onTheme={toggleTheme}
				onLock={async () => {
					await client.call("lock").catch(() => {});
					await refresh();
				}}
			/>
			{problem && <p className="banner">{problem.message}</p>}
			<div className="overview">
				{status.storage && <Storage storage={status.storage} />}
				{status.activity && (
					<Activity
						activity={status.activity}
						onSeed={async () => {
							await client.call("seed").catch(() => {});
							await refresh();
						}}
					/>
				)}
			</div>
			{status.schedule && <Schedule client={client} schedule={status.schedule} onChange={() => void refresh()} />}
			{status.mirror && <Mirror client={client} mirror={status.mirror} onChange={() => void refresh()} />}
			<Queue client={client} refreshKey={tick} />
			<Explorer client={client} refreshKey={refreshKey} />
			<footer className="facts">
				<span>X25519 key exchange</span>
				<span>AES-256-CTR</span>
				<span>HMAC-SHA-256</span>
				<span>{nativeCrypto ? "WebCrypto" : "noble, no secure origin"}</span>
				<span>gocryptfs at rest</span>
				<span title="The server's key, pinned in this browser">{client.fingerprint}</span>
			</footer>
			{changing && (
				<PasswordDialog
					onSubmit={async (current, next) => {
						await client.call("password", { current, next });
					}}
					onClose={() => setChanging(false)}
				/>
			)}
			{recoveryKey && <RecoveryDialog recoveryKey={recoveryKey} onClose={() => setRecoveryKey(null)} />}
		</div>
	);
}
