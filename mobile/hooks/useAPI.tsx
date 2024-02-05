import axios, { AxiosResponse } from 'axios';
import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { RequestMethods } from '../@types/RequestMethods';
import { useAuth } from './useAuth';
import { useStorage } from './useStorage';

const APIContext = createContext<{
  apiUrl?: string;
  setApiUrl: React.Dispatch<React.SetStateAction<string | undefined>>;
  sendRequest: Promise<AxiosResponse<any, any>> | any;
}>({
  apiUrl: undefined,
  setApiUrl: () => undefined,
  sendRequest: () => undefined,
});

export function useAPI() {
  return useContext(APIContext);
}

export function APIProvider({ children }: { children: ReactNode }) {
  const { storage } = useStorage();

  const [apiUrl, setApiUrl] = useState<string | undefined>(
    storage?.getString('apiUrl') || undefined,
  );

  useEffect(() => {
    if (apiUrl) {
      storage?.set('apiUrl', apiUrl);
    }
  }, [apiUrl, storage]);

  const auth = useAuth();

  const sendRequest = useCallback(
    (
      method: RequestMethods,
      endpoint: string,
      data: Record<string, unknown> | undefined,
    ) => {
      try {
        if (!apiUrl) {
          console.log('No API URL');
          return;
        }

        const token = auth?.token;
        const masked = `${token?.substring(0, 4)}...${token?.substring(
          token?.length - 4,
        )}`;

        const url = `${apiUrl}${endpoint}`;

        const headers = {
          Authorization: `Bearer ${token}`,
          Cookie: `token=${token}`,
        };

        console.log('Headers', {
          ...headers,
          Authorization: `Bearer ${masked}`,
          Cookie: `token=${masked}`,
        });

        console.log(`${method} ${url}`);

        // TODO: Add encryption
        return axios.request({
          method,
          url,
          data,
          headers,
          withCredentials: true,
        });
      } catch (error) {
        console.log(error);
      }
    },
    [apiUrl, auth?.token],
  );

  return (
    <APIContext.Provider value={{ apiUrl, setApiUrl, sendRequest }}>
      {children}
    </APIContext.Provider>
  );
}
