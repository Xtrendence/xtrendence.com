/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useAPI } from './useAPI';
import { useAuth } from './useAuth';

const SocketContext = createContext<{
  socket: Socket | undefined;
  connected: boolean;
}>({
  socket: undefined,
  connected: false,
});

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { apiUrl } = useAPI();
  const { token } = useAuth();

  const [socket, setSocket] = useState<Socket | undefined>(undefined);
  const [connected, setConnected] = useState<boolean>(false);
  const [check, setCheck] = useState<NodeJS.Timeout>();
  const [previousAttempt, setPreviousAttempt] = useState<number>(0);

  const connect = useCallback(() => {
    // If the last attempt was less than 5 seconds ago, don't try again
    if (Date.now() - previousAttempt < 5000) {
      return;
    }

    const connection = io(apiUrl || '', {
      path: '/bot/socket.io',
      auth: {
        token,
      },
    });

    setPreviousAttempt(Date.now());

    connection.on('connect', () => {
      setConnected(true);
      console.log('Connected to socket');
    });

    connection.on('disconnect', () => {
      setConnected(false);
      connect();
      console.log('Disconnected from socket');
    });

    if (check) {
      clearInterval(check);
    }

    setCheck(
      setInterval(() => {
        if (!connection.connected) {
          connection.connect();
        }
      }, 5000),
    );

    setSocket(connection);
  }, [apiUrl, token, previousAttempt]);

  useEffect(() => {
    try {
      connect();
    } catch (error) {
      setTimeout(() => {
        connect();
      }, 1000);
    }
  }, [connect]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
      }}>
      {children}
    </SocketContext.Provider>
  );
}
