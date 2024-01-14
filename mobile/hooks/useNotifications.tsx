import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
} from 'react';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { useAPI } from './useAPI';
import { useAuth } from './useAuth';
import axios from 'axios';
import { decrypt } from '../utils/encryption';
import { MMKV } from 'react-native-mmkv';
import { useStorage } from './useStorage';

export async function onMessageReceived(token?: string, message?: any) {
  try {
    if (!token) {
      return;
    }

    const apiUrl = new MMKV().getString('apiUrl');

    if (!apiUrl) {
      console.log('No API URL');
      return;
    }

    const keyData = await axios.get(`${apiUrl}/bot/fcm/key?token=${token}`);

    if (keyData.status !== 200) {
      return;
    }

    const key = keyData.data?.key;
    const iv = keyData.data?.iv;

    const notification = JSON.parse(message.data.notifee);

    const channelId = await notifee.createChannel({
      id: 'bot',
      name: 'Bot Channel',
      vibration: true,
    });

    let title;
    let body;

    if (notification?.title) {
      title = decrypt(notification?.title, key, iv);
    }

    if (notification?.body) {
      body = decrypt(notification?.body, key, iv);
    }

    return notifee.displayNotification({
      title: title || notification?.title,
      body: body || notification?.body,
      android: {
        smallIcon: 'ic_stat_bot',
        sound: 'default',
        channelId,
        vibrationPattern: notification?.urgent
          ? [100, 250, 50, 250, 100, 50]
          : [20, 10],
        pressAction: {
          id: 'default',
        },
      },
    });
  } catch (error) {
    console.log(error);
  }
}

notifee.onBackgroundEvent(async () => {});

const NotificationsContext = createContext({});

export function useNotifications() {
  return useContext(NotificationsContext);
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { storage } = useStorage();
  const { sendRequest } = useAPI();

  const handleSaveToken = useCallback(
    async (fcmToken: string) => {
      try {
        if (!storage?.getString('apiUrl') || !storage?.getString('token')) {
          return;
        }

        console.log('Saving FCM Token...');

        const response = await sendRequest('POST', '/bot/fcm', {
          token: auth?.token,
          fcmToken,
        });

        const saved = response.status === 200;

        if (!saved) {
          console.log('Failed to save FCM Token');
          return;
        }

        console.log('Saved FCM Token');
      } catch (error) {
        console.log(error);
      }
    },
    [auth?.token, sendRequest, storage],
  );

  const registerDevice = useCallback(async () => {
    try {
      await messaging().registerDeviceForRemoteMessages();

      const fmcToken = await messaging().getToken();

      handleSaveToken(fmcToken);
    } catch (error) {
      console.log(error);
    }
  }, [handleSaveToken]);

  useEffect(() => {
    registerDevice();
  }, [registerDevice]);

  return (
    <NotificationsContext.Provider value={{}}>
      {children}
    </NotificationsContext.Provider>
  );
}
