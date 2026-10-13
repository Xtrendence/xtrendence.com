import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import type { TPlugStatus, TSettings } from "../../shared/types";
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
			settings: Omit<TSettings, "lights" | "plugs" | "alertLevel"> & {
				lights: (Omit<TSettings["lights"][number], "id"> & { id?: number })[];
				plugs: (Omit<TSettings["plugs"][number], "id"> & { id?: number })[];
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

// Separate from settings, since reaching each plug takes a moment
export function usePlugStatus(enabled: boolean) {
	return useQuery({
		queryKey: ["plug-status"],
		queryFn: async () => {
			const { data } = await authAxios().get("/plugs/status");
			return data as Record<number, TPlugStatus>;
		},
		enabled,
		refetchInterval: 15_000,
		refetchOnWindowFocus: false,
	});
}

export function useCyclePlug() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: number) => {
			try {
				await authAxios().post(`/plugs/${id}/cycle`);
			} catch (error) {
				const message = isAxiosError(error)
					? error.response?.data?.error
					: null;
				throw new Error(message || "Could not reach the bridge");
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["plug-status"] });
		},
	});
}
