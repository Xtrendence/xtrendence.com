import { atom, getDefaultStore, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { TDeviceInfo } from "../../shared/types";

export const store = getDefaultStore();

export const lightsAtom = atom<Record<string, TDeviceInfo>>({});

export const tokenAtom = atomWithStorage("lights-token", "");
export const useToken = () => useAtom(tokenAtom);
