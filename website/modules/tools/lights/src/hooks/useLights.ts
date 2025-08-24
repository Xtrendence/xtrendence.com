import { useQuery } from "@tanstack/react-query";
import type { TLight } from "../../shared/types";
import { authAxios } from "../utils/utils";

export function useLights() {
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
