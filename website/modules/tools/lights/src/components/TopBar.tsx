import { useCallback, useState } from "react";
import { useClimate } from "../hooks/useClimate";
import { useTheme } from "../hooks/useTheme";
import { authAxios } from "../utils/utils";
import { Settings } from "./Settings";

export function TopBar() {
	const climate = useClimate().data;
	const { toggleTheme } = useTheme();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const closeSettings = useCallback(() => setSettingsOpen(false), []);

	return (
		<>
			<header className="topbar glass noselect">
				<span className="wordmark">Clicker</span>

				<div className="climate">
					<span className="readout" title="Temperature">
						<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M12 2a3 3 0 0 1 3 3v8.6a5 5 0 1 1-6 0V5a3 3 0 0 1 3-3Zm0 2a1 1 0 0 0-1 1v9.7l-.5.3a3 3 0 1 0 3 0l-.5-.3V5a1 1 0 0 0-1-1Z" />
						</svg>
						{climate?.temp != null ? `${climate.temp.toFixed(1)}°C` : "--°C"}
					</span>
					<span className="readout" title="Humidity">
						<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M12 2.7l5 6.2a7 7 0 1 1-10 0l5-6.2Zm0 3.2-3.4 4.3a5 5 0 1 0 6.8 0L12 5.9Z" />
						</svg>
						{climate?.humidity != null
							? `${climate.humidity.toFixed(1)}%`
							: "--%"}
					</span>
				</div>

				<button
					className="icon-btn theme-toggle"
					type="button"
					aria-label="Toggle colour theme"
					onClick={toggleTheme}
				>
					<svg
						className="sun"
						viewBox="0 0 24 24"
						fill="currentColor"
						aria-hidden="true"
					>
						<path d="M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-1-14h2v3h-2V1Zm0 19h2v3h-2v-3ZM3.5 4.9 4.9 3.5 7 5.6 5.6 7 3.5 4.9ZM17 18.4l1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1ZM19.1 3.5l1.4 1.4L18.4 7 17 5.6l2.1-2.1ZM5.6 17 7 18.4l-2.1 2.1-1.4-1.4L5.6 17ZM23 11v2h-3v-2h3ZM4 11v2H1v-2h3Z" />
					</svg>
					<svg
						className="moon"
						viewBox="0 0 24 24"
						fill="currentColor"
						aria-hidden="true"
					>
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
					</svg>
				</button>

				<button
					className={`icon-btn settings-toggle${settingsOpen ? " open" : ""}`}
					type="button"
					aria-label={settingsOpen ? "Close settings" : "Open settings"}
					aria-expanded={settingsOpen}
					title="Settings"
					onClick={() => setSettingsOpen((open) => !open)}
				>
					<svg
						className="gear"
						viewBox="0 0 24 24"
						fill="currentColor"
						aria-hidden="true"
					>
						<path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.47.47 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 0 0-.12-.61l-2.01-1.58ZM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2Z" />
					</svg>
					<svg
						className="close"
						viewBox="0 0 24 24"
						fill="currentColor"
						aria-hidden="true"
					>
						<path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
					</svg>
				</button>

				<button
					className="icon-btn icon-btn--danger"
					type="button"
					aria-label="Restart the bridge"
					title="Restart"
					onClick={() => {
						authAxios().get("/lights/restart");
						window.location.reload();
					}}
				>
					<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8Z" />
					</svg>
				</button>
			</header>

			<Settings open={settingsOpen} onClose={closeSettings} />
		</>
	);
}
