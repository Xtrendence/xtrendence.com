import { useEffect, useState } from "react";
import type { TEntry } from "../../shared/protocol";
import type { VaultClient } from "../lib/api";
import { formatBytes, formatDate } from "../lib/format";
import { Dialog } from "./Dialog";
import { Icon, kindOf } from "./Icons";

const MIME: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	avif: "image/avif",
	bmp: "image/bmp",
	mp4: "video/mp4",
	m4v: "video/mp4",
	mov: "video/quicktime",
	webm: "video/webm",
	mp3: "audio/mpeg",
	m4a: "audio/mp4",
	aac: "audio/aac",
	wav: "audio/wav",
	ogg: "audio/ogg",
	opus: "audio/ogg",
	flac: "audio/flac",
	txt: "text/plain",
	md: "text/plain",
	json: "text/plain",
	csv: "text/plain",
	log: "text/plain",
};

// Text only previews up to this size, anything can still be saved
const TEXT_LIMIT = 512 * 1024;

type TProps = { client: VaultClient; path: string; entry: TEntry; onClose: () => void };

export function Preview({ client, path, entry, onClose }: TProps) {
	const [done, setDone] = useState(0);
	const [url, setUrl] = useState<string | null>(null);
	const [text, setText] = useState<string | null>(null);
	const [error, setError] = useState("");

	const extension = entry.name.split(".").pop()?.toLowerCase() ?? "";
	const mime = MIME[extension] ?? "application/octet-stream";
	const kind = kindOf(entry.name);

	useEffect(() => {
		const controller = new AbortController();
		let made: string | null = null;
		client
			.download(path, entry.size, setDone, controller.signal)
			.then(async (blob) => {
				const typed = new Blob([blob], { type: mime });
				if (mime === "text/plain" && entry.size <= TEXT_LIMIT) {
					setText(await typed.text());
				}
				made = URL.createObjectURL(typed);
				setUrl(made);
			})
			.catch((failure) => {
				if (!controller.signal.aborted) {
					setError(failure instanceof Error ? failure.message : "Could not open the file");
				}
			});
		// The decrypted copy only ever lives in this tab's memory, and goes when the dialog closes
		return () => {
			controller.abort();
			if (made) {
				URL.revokeObjectURL(made);
			}
		};
	}, [client, path, entry.size, mime]);

	const percent = entry.size > 0 ? Math.round((done / entry.size) * 100) : 100;

	return (
		<Dialog eyebrow={`${formatBytes(entry.size)}, ${formatDate(entry.mtime)}`} title={entry.name} onClose={onClose} wide>
			<div className="preview">
				{!url && !error && (
					<div className="preview-wait">
						<span className="chip chip--big">
							<Icon name={kind} />
						</span>
						<div className="bar">
							<span style={{ width: `${percent}%` }} />
						</div>
						<span className="seed-meta">Decrypting, {percent}%</span>
					</div>
				)}
				{error && <p className="dialog-error">{error}</p>}
				{url && mime.startsWith("image/") && <img src={url} alt={entry.name} />}
				{url && mime.startsWith("video/") && <video src={url} controls autoPlay playsInline />}
				{url && mime.startsWith("audio/") && <audio src={url} controls autoPlay />}
				{url && text !== null && <pre className="preview-text">{text}</pre>}
				{url && !/^(image|video|audio)\//.test(mime) && text === null && (
					<p className="dialog-text">No preview for this kind of file, save it to open it.</p>
				)}
			</div>
			<div className="dialog-foot">
				<button className="btn btn--ghost" type="button" onClick={onClose}>
					Close
				</button>
				{url ? (
					<a className="btn btn--accent" href={url} download={entry.name}>
						<Icon name="download" />
						Save
					</a>
				) : (
					<button className="btn btn--accent" type="button" disabled>
						<Icon name="download" />
						Save
					</button>
				)}
			</div>
		</Dialog>
	);
}
