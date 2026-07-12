import { Button, Text } from "@chakra-ui/react";
import { useClimate } from "../hooks/useClimate";
import { authAxios } from "../utils/utils";

export function TopBar() {
	const climate = useClimate().data;

	return (
		<div
			className="w-full px-4 h-16 bg-black/80 border-b-[1px] flex items-center justify-between relative"
			style={{
				borderColor: "var(--chakra-colors-border)",
			}}
		>
			<Text
				style={{
					fontFamily: "Compacta, sans-serif",
					fontSize: "1.5rem",
					fontWeight: 800,
				}}
			>
				Clicker
			</Text>
			<div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4">
				<Text style={{ fontSize: "0.9rem", fontWeight: 600 }}>
					{climate?.temp != null ? `${climate.temp.toFixed(1)}°C` : "--°C"}
				</Text>
				<Text style={{ fontSize: "0.9rem", fontWeight: 600 }}>
					{climate?.humidity != null
						? `${climate.humidity.toFixed(1)}%`
						: "--%"}
				</Text>
			</div>
			<Button
				size="sm"
				variant="outline"
				color="red"
				onClick={() => {
					authAxios().get("/lights/restart");
					window.location.reload();
				}}
			>
				Restart
			</Button>
		</div>
	);
}
