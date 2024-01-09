import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
} from 'react';
import messaging from '@react-native-firebase/messaging';

messaging().setBackgroundMessageHandler(async () => {});

const notificationsContext = createContext({});

export function useNotifications() {
  return useContext(notificationsContext);
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const registerDevice = useCallback(async () => {
    try {
      await messaging().registerDeviceForRemoteMessages();

      const fmcToken = await messaging().getToken();

      console.log('fcmToken', fmcToken);
    } catch (error) {
      console.log(error);
    }
  }, []);

  useEffect(() => {
    registerDevice();
  }, [registerDevice]);

  return (
    <notificationsContext.Provider value={{}}>
      {children}
    </notificationsContext.Provider>
  );
}
