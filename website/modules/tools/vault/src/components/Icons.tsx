const PATHS = {
	key: "M7 14a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm5.6-4A6 6 0 1 0 12.6 14H15v3h3v-3h3v-4h-8.4Z",
	lock: "M6 10V8a6 6 0 1 1 12 0v2h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h1Zm2 0h8V8a4 4 0 1 0-8 0v2Zm3 5v3h2v-3h-2Z",
	sun: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm-1-6h2v3h-2zm0 19h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM4.2 2.8l2.1 2.1-1.4 1.4-2.1-2.1zm14.1 14.1 2.1 2.1-1.4 1.4-2.1-2.1zM2.8 19.8l2.1-2.1 1.4 1.4-2.1 2.1zM16.9 5.7 19 3.6l1.4 1.4-2.1 2.1z",
	moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
	folder: "M3 5a2 2 0 0 1 2-2h4.6l2 2H19a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z",
	image: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 13.6V19h14v-3.4l-4-4-4.5 4.5-2.5-2.5L5 16.6ZM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
	video: "M4 5h11a2 2 0 0 1 2 2v2.4l4-2.9v11l-4-2.9V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
	audio: "M9 17.5V5l12-2v12.5a3 3 0 1 1-2-2.8V7.4l-8 1.3v8.8a3 3 0 1 1-2-2.8",
	text: "M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V9h5.5L13 3.5ZM7 12v2h10v-2H7Zm0 4v2h7v-2H7Z",
	file: "M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V9h5.5L13 3.5Z",
	archive: "M4 3h16l1 4v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7l1-4Zm1.6 2-.5 2h13.8l-.5-2H5.6ZM9 10v2h6v-2H9Z",
	download: "M11 3h2v9.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3V3ZM4 19h16v2H4v-2Z",
	copy: "M8 3h11a2 2 0 0 1 2 2v11h-2V5H8V3ZM5 7h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z",
	repeat: "M17 2l4 4-4 4V7H7a2 2 0 0 0-2 2v3H3V9a4 4 0 0 1 4-4h10V2ZM7 22l-4-4 4-4v3h10a2 2 0 0 0 2-2v-3h2v3a4 4 0 0 1-4 4H7v3Z",
	shield: "M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1.2 14.6-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6Z",
	search: "M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z",
	up: "M12 4l7 7-1.4 1.4L13 7.8V20h-2V7.8l-4.6 4.6L5 11l7-7Z",
};

export type TIconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: TIconName; className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" aria-hidden="true">
			<path d={PATHS[name]} />
		</svg>
	);
}

const KINDS: [TIconName, RegExp][] = [
	["image", /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif|svg|dng|raw)$/i],
	["video", /\.(mp4|mov|m4v|webm|mkv|avi|3gp|mts)$/i],
	["audio", /\.(mp3|m4a|aac|wav|flac|ogg|opus|amr)$/i],
	["text", /\.(txt|md|json|csv|log|xml|html?|pdf|docx?|xlsx?|pptx?|odt)$/i],
	["archive", /\.(zip|rar|7z|tar|gz|tgz|xz|apk)$/i],
];

export function kindOf(name: string): TIconName {
	return KINDS.find(([, pattern]) => pattern.test(name))?.[0] ?? "file";
}
