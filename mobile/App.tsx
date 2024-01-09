import React from 'react';
import { NotificationsProvider } from './hooks/useNotifications';
import { AuthProvider } from './hooks/useAuth';
import { APIProvider } from './hooks/useAPI';
import Login from './screens/Login';

export default function App() {
  return (
    <AuthProvider>
      <APIProvider>
        <NotificationsProvider>
          <Login />
        </NotificationsProvider>
      </APIProvider>
    </AuthProvider>
  );
}
