import React, { ReactNode, createContext, useContext } from 'react';
import { MMKV } from 'react-native-mmkv';

const StorageContext = createContext<{
  storage: MMKV | undefined;
}>({
  storage: undefined,
});

export const useStorage = () => useContext(StorageContext);

export function StorageProvider({ children }: { children: ReactNode }) {
  const storage = new MMKV();

  return (
    <StorageContext.Provider value={{ storage }}>
      {children}
    </StorageContext.Provider>
  );
}
