export function formatBytes(bytes: number) {
	const units = ["B", "KB", "MB", "GB", "TB"];
	let value = Math.max(0, bytes);
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatDate(time: number) {
	return new Date(time).toLocaleString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function formatTime(time: number) {
	return new Date(time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// The clipboard API needs a secure origin, so plain HTTP on the LAN falls back
export async function copyText(text: string) {
	try {
		if (window.isSecureContext && navigator.clipboard) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {}
	const area = document.createElement("textarea");
	area.value = text;
	area.style.position = "fixed";
	area.style.opacity = "0";
	document.body.append(area);
	area.select();
	const ok = document.execCommand("copy");
	area.remove();
	return ok;
}
