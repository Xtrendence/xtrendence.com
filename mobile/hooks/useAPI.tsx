import axios, { AxiosResponse } from 'axios';
import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
} from 'react';
import { RequestMethods } from '../@types/RequestMethods';
import { useAuth } from './useAuth';

const APIContext = createContext<{
  sendRequest: Promise<AxiosResponse<any, any>> | any;
}>({
  sendRequest: () => undefined,
});

export function useAPI() {
  return useContext(APIContext);
}

export function APIProvider({ children }: { children: ReactNode }) {
  const apiUrl = 'http://192.168.1.75:3000';
  const auth = useAuth();

  const sendRequest = useCallback(
    (
      method: RequestMethods,
      endpoint: string,
      data: Record<string, unknown> | undefined,
    ) => {
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

      return axios.request({
        method,
        url,
        data,
        headers,
        withCredentials: true,
      });
    },
    [auth],
  );

  return (
    <APIContext.Provider value={{ sendRequest }}>
      {children}
    </APIContext.Provider>
  );
}
