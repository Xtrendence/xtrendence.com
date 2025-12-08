import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import type { TDeviceInfo } from "../../shared/types";
import { authAxios } from "../utils/utils";

export const BULB_COLORS = {
  blue: {
    hue: 240,
    saturation: 100,
    hex: "0000FF",
  },
  red: {
    hue: 0,
    saturation: 100,
    hex: "FF0000",
  },
  green: {
    hue: 120,
    saturation: 100,
    hex: "00FF00",
  },
  purple: {
    hue: 300,
    saturation: 100,
    hex: "800080",
  },
  orange: {
    hue: 39,
    saturation: 100,
    hex: "FFA500",
  },
  white: {
    hue: 0,
    saturation: 0,
    hex: "FFFFFF",
  },
  yellow: {
    hue: 31,
    saturation: 10,
    hex: "e8ddd1",
  },
  pink: {
    hue: 302,
    saturation: 45,
    hex: "ed82e9",
  },
};

export function getColorByHueAndSaturation(hue: number, saturation: number) {
  for (const [key, value] of Object.entries(BULB_COLORS)) {
    if (value.hue === hue && value.saturation === saturation) {
      return key;
    }
  }
  return "unknown";
}

export function useBulb() {
  const queryClient = useQueryClient();
  const timeout = useRef<NodeJS.Timeout | null>(null);

  const optimistic = useCallback(
    (id: string, key: keyof TDeviceInfo, value: unknown) => {
      queryClient.setQueryData(["device", id], (oldData: TDeviceInfo | undefined) => ({
        ...oldData,
        [key]: value,
      }));
    },
    [queryClient],
  );

  const invalidate = useCallback(
    (id: string) => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }

      timeout.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["device", id] });
      }, 2000);
    },
    [queryClient],
  );

  return {
    state: async (id: string) => {
      const { data } = await authAxios().get(`/lights/${id}/state`);
      return data as TDeviceInfo;
    },
    on: async (id: string) => {
      optimistic(id, "device_on", true);
      const { data } = await authAxios().get(`/lights/${id}/power/on`);
      invalidate(id);
      return data;
    },
    off: async (id: string) => {
      optimistic(id, "device_on", false);
      const { data } = await authAxios().get(`/lights/${id}/power/off`);
      invalidate(id);
      return data;
    },
    color: async (id: string, hex: string) => {
      const color = Object.values(BULB_COLORS).find((c) => c.hex === hex);
      if (color) {
        optimistic(id, "hue", color.hue);
        optimistic(id, "saturation", color.saturation);
      }

      optimistic(id, "device_on", true);
      const { data } = await authAxios().get(`/lights/${id}/color/${hex}`);
      invalidate(id);
      return data;
    },
    brightness: async (id: string, value: number) => {
      optimistic(id, "device_on", true);
      optimistic(id, "brightness", value);
      const { data } = await authAxios().get(`/lights/${id}/brightness/${value}`);
      invalidate(id);
      return data;
    },
  };
}
