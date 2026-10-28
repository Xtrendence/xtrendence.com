// Matches the site's theme before first paint, kept external for the CSP
(() => {
	try {
		const stored = localStorage.getItem("theme");
		const light = stored ? stored === "light" : window.matchMedia("(prefers-color-scheme: light)").matches;
		document.documentElement.classList.toggle("light", light);
		document.documentElement.classList.toggle("dark", !light);
	} catch {}
})();
