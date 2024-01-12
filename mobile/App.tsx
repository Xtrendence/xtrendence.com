import React from 'react';
import {
  NotificationsProvider,
  onMessageReceived,
} from './hooks/useNotifications';
import { AuthProvider } from './hooks/useAuth';
import { APIProvider } from './hooks/useAPI';
import Login from './screens/Login';
import Conversation from './screens/Conversation';
import Settings from './screens/Settings';
import { PageProvider, usePage } from './hooks/usePage';
import { StorageProvider } from './hooks/useStorage';
import Background from './components/core/Background';
import messaging from '@react-native-firebase/messaging';
import { MMKV } from 'react-native-mmkv';

messaging().onMessage(message => {
  return onMessageReceived(new MMKV().getString('token'), message);
});

messaging().setBackgroundMessageHandler(message => {
  return onMessageReceived(new MMKV().getString('token'), message);
});

function Index() {
  const { page } = usePage();

  return (
    <AuthProvider>
      <APIProvider>
        <NotificationsProvider>
          <Background>
            {page === 'login' && <Login />}
            {page === 'conversation' && <Conversation />}
            {page === 'settings' && <Settings />}
          </Background>
        </NotificationsProvider>
      </APIProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <StorageProvider>
      <PageProvider>
        <Index />
      </PageProvider>
    </StorageProvider>
  );
}
