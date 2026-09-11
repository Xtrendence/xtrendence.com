import { useLights } from "../hooks/useLights";
import { Device } from "./Device";
import { TopBar } from "./TopBar";

export function Lights() {
	const { data: lights, isPending, isError } = useLights();

	return (
		<>
			<TopBar />
			<main className="shell">
				{lights?.length ? (
					<div className="grid">
						{lights.map((light, index) => (
							<Device key={light.id} light={light} index={index} />
						))}
					</div>
				) : (
					<div className="empty">
						{isPending
							? "Finding bulbs..."
							: isError
								? "The bridge is not answering."
								: "No bulbs paired."}
					</div>
				)}
			</main>
		</>
	);
}
