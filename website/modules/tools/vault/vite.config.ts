import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	base: "/",
	// Inlined data: URLs would be blocked by the font-src CSP
	build: { sourcemap: false, assetsInlineLimit: 0 },
	server: {
		proxy: {
			"/api": { target: "http://localhost:7900" },
		},
	},
});
