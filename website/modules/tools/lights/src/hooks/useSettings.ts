import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import type { TSettings } from "../../shared/types";
import { authAxios } from "../utils/utils";

export function useSettings(enabled: boolean) {
	return useQuery({
		queryKey: ["settings"],
		queryFn: async () => {
			const { data } = await authAxios().get("/settings");
			return data as TSettings;
		},
		enabled,
		refetchOnWindowFocus: false,
	});
}

export function useSaveSettings() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (
			settings: Omit<TSettings, "lights" | "alertLevel"> & {
				lights: (Omit<TSettings["lights"][number], "id"> & { id?: number })[];
			},
		) => {
			try {
				const { data } = await authAxios().put("/settings", settings);
				return data as TSettings;
			} catch (error) {
				const message = isAxiosError(error)
					? error.response?.data?.error
					: null;
				throw new Error(message || "Could not reach the bridge");
			}
		},
		onSuccess: (settings) => {
			queryClient.setQueryData(["settings"], settings);
			queryClient.invalidateQueries({ queryKey: ["lights"] });
			queryClient.invalidateQueries({ queryKey: ["device"] });
			setTimeout(
				() => queryClient.invalidateQueries({ queryKey: ["climate"] }),
				3000,
			);
		},
	});
}
