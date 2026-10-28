import { type CSSProperties, useCallback, useEffect, useState } from "react";
import type { TEntry, TListing } from "../../shared/protocol";
import type { VaultClient } from "../lib/api";
import { formatBytes, formatDate } from "../lib/format";
import { Icon, kindOf } from "./Icons";
import { Preview } from "./Preview";

// Read only on purpose, changes go through the Samba share

type TProps = { client: VaultClient; refreshKey: number };

export function Explorer({ client, refreshKey }: TProps) {
	const [path, setPath] = useState("");
	const [listing, setListing] = useState<TListing | null>(null);
	const [filter, setFilter] = useState("");
	const [error, setError] = useState("");
	const [open, setOpen] = useState<{ path: string; entry: TEntry } | null>(null);

	const load = useCallback(
		async (target: string) => {
			try {
				const next = await client.call<TListing>("list", { path: target });
				setListing(next);
				setError("");
			} catch (failure) {
				setError(failure instanceof Error ? failure.message : "Could not open the folder");
			}
		},
		[client],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey changes after imports, so an open folder fills in by itself
	useEffect(() => {
		void load(path);
	}, [load, path, refreshKey]);

	const go = (target: string) => {
		setFilter("");
		setPath(target);
	};

	const crumbs = path ? path.split("/") : [];
	const query = filter.trim().toLowerCase();
	const entries = (listing?.path === path ? listing.entries : []).filter((entry) => !query || entry.name.toLowerCase().includes(query));
	const folders = entries.filter((entry) => entry.dir).length;

	return (
		<section className="panel glass explorer">
			<div className="explorer-head">
				<nav className="crumbs" aria-label="Folder">
					<button type="button" className={`crumb${crumbs.length === 0 ? " is-here" : ""}`} onClick={() => go("")}>
						<Icon name="shield" />
						Vault
					</button>
					{crumbs.map((crumb, index) => {
						const target = crumbs.slice(0, index + 1).join("/");
						return (
							<button
								type="button"
								key={target}
								className={`crumb${index === crumbs.length - 1 ? " is-here" : ""}`}
								onClick={() => go(target)}
							>
								{crumb}
							</button>
						);
					})}
				</nav>
				<label className="search">
					<Icon name="search" />
					<input
						type="search"
						placeholder="Filter this folder"
						value={filter}
						onChange={(event) => setFilter(event.target.value)}
						aria-label="Filter this folder"
					/>
				</label>
			</div>

			<div className="explorer-meta">
				<span>
					{folders} folders, {entries.length - folders} files
				</span>
				{crumbs.length > 0 && (
					<button className="btn btn--ghost btn--sm" type="button" onClick={() => go(crumbs.slice(0, -1).join("/"))}>
						<Icon name="up" />
						Up
					</button>
				)}
			</div>

			{error && <p className="dialog-error">{error}</p>}
			{!error && listing?.path === path && entries.length === 0 && (
				<p className="empty">{query ? "Nothing here matches." : "This folder is empty."}</p>
			)}

			<ul className="rows" key={path}>
				{entries.map((entry, index) => {
					const full = path ? `${path}/${entry.name}` : entry.name;
					const kind = entry.dir ? "folder" : kindOf(entry.name);
					return (
						<li key={entry.name} style={{ "--i": Math.min(index, 24) } as CSSProperties}>
							<button
								type="button"
								className={`row row--${kind}`}
								onClick={() => (entry.dir ? go(full) : setOpen({ path: full, entry }))}
							>
								<span className="chip">
									<Icon name={kind} />
								</span>
								<span className="row-text">
									<span className="row-name">{entry.name}</span>
									<span className="row-meta">
										{entry.dir ? "Folder" : formatBytes(entry.size)}
										<span className="row-dot" />
										{formatDate(entry.mtime)}
									</span>
								</span>
							</button>
						</li>
					);
				})}
			</ul>

			{open && <Preview client={client} path={open.path} entry={open.entry} onClose={() => setOpen(null)} />}
		</section>
	);
}
