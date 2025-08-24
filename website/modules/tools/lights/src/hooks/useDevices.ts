import { useQuery } from "@tanstack/react-query";
import type { TDeviceInfo } from "../../shared/types";
import { lightsAtom, store } from "../store/store";
import { authAxios } from "../utils/utils";

export function useDevice(id: string) {
  return useQuery({
    queryKey: ["device", id],
    queryFn: async () => {
      const existing = Boolean(store.get(lightsAtom)?.[id]);
      const device = await authAxios().get(`/lights/${id}/state?initial=${!existing}`);

      if (!device.data) {
        throw new Error("No device data");
      }

      const info = device.data as TDeviceInfo;
      store.set(lightsAtom, (prev) => ({
        ...prev,
        [id]: {
          ...prev?.[id],
          ...info,
        },
      }));

      return info;
    },
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: true,
    refetchOnReconnect: true,
    refetchInterval: 15_000,
    staleTime: 15_000,
  });
}
