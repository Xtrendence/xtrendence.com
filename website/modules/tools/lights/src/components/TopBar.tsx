import { useClimate } from "../hooks/useClimate";
import { useTheme } from "../hooks/useTheme";
import { authAxios } from "../utils/utils";

export function TopBar() {
	const climate = useClimate().data;
	const { toggleTheme } = useTheme();

	return (
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
					{climate?.humidity != null ? `${climate.humidity.toFixed(1)}%` : "--%"}
				</span>
			</div>

			<button
				className="icon-btn theme-toggle"
				type="button"
				aria-label="Toggle colour theme"
				onClick={toggleTheme}
			>
				<svg className="sun" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-1-14h2v3h-2V1Zm0 19h2v3h-2v-3ZM3.5 4.9 4.9 3.5 7 5.6 5.6 7 3.5 4.9ZM17 18.4l1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1ZM19.1 3.5l1.4 1.4L18.4 7 17 5.6l2.1-2.1ZM5.6 17 7 18.4l-2.1 2.1-1.4-1.4L5.6 17ZM23 11v2h-3v-2h3ZM4 11v2H1v-2h3Z" />
				</svg>
				<svg className="moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
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
	);
}
