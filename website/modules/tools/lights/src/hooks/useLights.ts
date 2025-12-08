import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { TLight } from "../../shared/types";
import { authAxios } from "../utils/utils";

export function useLights() {
	const queryClient = useQueryClient();

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				// Trigger a refetch when the tab becomes visible
				queryClient.invalidateQueries({ queryKey: ["lights"] });
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [queryClient]);

	return useQuery({
		queryKey: ["lights"],
		queryFn: async () => {
			const lights = await authAxios().get("/lights");
			if (lights.status !== 200) {
				throw new Error("Failed to fetch lights");
			}
			return lights.data as TLight[];
		},
		refetchOnWindowFocus: true,
		refetchIntervalInBackground: true,
		refetchOnReconnect: true,
		refetchInterval: 15_000,
		staleTime: 15_000,
	});
}
