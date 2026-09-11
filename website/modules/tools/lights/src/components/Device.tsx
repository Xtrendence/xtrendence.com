import { useEffect, useState } from "react";
import { isNullish } from "remeda";
import { useDebounceCallback } from "usehooks-ts";
import type { TLight } from "../../shared/types";
import { BULB_COLORS, getColorByHueAndSaturation, useBulb } from "../hooks/useBulb";
import { useDevice } from "../hooks/useDevices";

// Swatch order runs warm to cool so the row reads as a spectrum rather than
// the arbitrary order the colours happen to be declared in
const SWATCHES = [
	"white",
	"yellow",
	"orange",
	"red",
	"pink",
	"purple",
	"blue",
	"green",
] as const;

// Yellow and white are nearly the same hex, so the dot gets a visible edge
const SWATCH_DISPLAY: Partial<Record<(typeof SWATCHES)[number], string>> = {
	white: "#f4f6fb",
	yellow: "#f2e2c4",
};

function swatchColor(name: (typeof SWATCHES)[number]) {
	return SWATCH_DISPLAY[name] ?? `#${BULB_COLORS[name].hex}`;
}

export function Device({ light, index }: { light: TLight; index: number }) {
	const bulb = useBulb();
	const device = useDevice(light.id).data;

	const [brightness, setBrightness] = useState<number>(0);
	const [disableBrightness, setDisableBrightness] = useState<boolean>(false);

	useEffect(() => {
		if (device?.brightness) {
			setBrightness(device.brightness);
		}
	}, [device?.brightness]);

	const commitBrightness = useDebounceCallback((value: number) => {
		setDisableBrightness(true);
		bulb.brightness(light.id, value);
		setTimeout(() => setDisableBrightness(false), 3000);
	}, 1000);

	const unknown = isNullish(device?.device_on);
	const isOn = Boolean(device?.device_on);
	const active = getColorByHueAndSaturation(device?.hue ?? 0, device?.saturation ?? 0);

	// The card takes its wash from whatever the bulb is currently showing
	const bulbColor =
		active in BULB_COLORS ? swatchColor(active as (typeof SWATCHES)[number]) : "#f4f6fb";

	return (
		<article
			className={`light-card glass${isOn ? " is-on" : ""}`}
			style={
				{
					"--bulb-raw": bulbColor,
					"--i": index,
				} as React.CSSProperties
			}
		>
			<div className="light-head">
				<span className="light-name">
					<b>{light.name}</b>
					<span className="light-state">
						{unknown ? "Unreachable" : isOn ? "On" : "Off"}
					</span>
				</span>

				<button
					className={`rocker${isOn ? " on" : ""}`}
					type="button"
					role="switch"
					aria-checked={isOn}
					aria-label={`Turn ${light.name} ${isOn ? "off" : "on"}`}
					disabled={unknown}
					onClick={() => (isOn ? bulb.off(light.id) : bulb.on(light.id))}
				>
					<i />
				</button>
			</div>

			<div
				className={`spectrum${unknown ? " disabled" : ""}`}
				style={{ "--stops": SWATCHES.map(swatchColor).join(", ") } as React.CSSProperties}
			>
				<span className="spectrum-glow" aria-hidden="true" />
				<div className="swatches">
					{SWATCHES.map((name) => (
						<button
							key={name}
							className={`swatch${active === name ? " active" : ""}`}
							type="button"
							aria-label={name}
							title={name}
							style={{ "--c": swatchColor(name) } as React.CSSProperties}
							disabled={unknown || active === name}
							onClick={() => bulb.color(light.id, BULB_COLORS[name].hex)}
						/>
					))}
				</div>
			</div>

			<div className="dimmer">
				<div className="dimmer-head">
					<span>Brightness</span>
					<b>{brightness}%</b>
				</div>
				<input
					type="range"
					min={1}
					max={100}
					value={brightness}
					aria-label={`${light.name} brightness`}
					disabled={disableBrightness || unknown}
					style={{ "--fill": `${brightness}%` } as React.CSSProperties}
					onChange={(event) => setBrightness(Number(event.target.value))}
					onPointerUp={() => commitBrightness(brightness)}
					onKeyUp={() => commitBrightness(brightness)}
				/>
			</div>
		</article>
	);
}
