import { Box } from "@chakra-ui/react";
import { useLights } from "../hooks/useLights";
import { Device } from "./Device";
import { TopBar } from "./TopBar";

export function Lights() {
	const lights = useLights().data;

	return (
		<Box
			style={
				{
					// background: "url(/tools/lights/img/bg.jpg)",
					// backgroundSize: "cover",
					// backgroundPosition: "center",
					// backgroundRepeat: "no-repeat",
					// backgroundAttachment: "fixed",
				}
			}
			background={"bg.subtle"}
			className="w-[100dvw] h-[100dvh] flex flex-col items-center"
		>
			<TopBar />
			<div className="flex flex-wrap items-center justify-center p-4 gap-4 top-16 w-full max-h-[calc(100%-4rem)] overflow-x-hidden overflow-y-auto">
				{lights?.map((light) => {
					return <Device key={light.id} light={light} />;
				})}
			</div>
		</Box>
	);
}
