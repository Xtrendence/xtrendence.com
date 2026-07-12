import { useQuery } from "@tanstack/react-query";
import { authAxios } from "../utils/utils";

export type TClimate = {
	temp: number | null;
	humidity: number | null;
};

export function useClimate() {
	return useQuery({
		queryKey: ["climate"],
		queryFn: async () => {
			const climate = await authAxios().get("/climate");
			if (climate.status !== 200) {
				throw new Error("Failed to fetch climate");
			}
			return climate.data as TClimate;
		},
		refetchOnWindowFocus: true,
		refetchIntervalInBackground: true,
		refetchOnReconnect: true,
		refetchInterval: 10_000,
		staleTime: 10_000,
	});
}
