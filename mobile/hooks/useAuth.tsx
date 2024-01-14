import React, {
  Dispatch,
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';
import { useStorage } from './useStorage';

const AuthContext = createContext<{
  token: string | undefined;
  setToken: Dispatch<React.SetStateAction<string>>;
  loggedIn: boolean;
  setLoggedIn: Dispatch<React.SetStateAction<boolean>>;
  logout: () => void;
}>({
  token: undefined,
  setToken: () => undefined,
  loggedIn: false,
  setLoggedIn: () => undefined,
  logout: () => undefined,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { storage } = useStorage();

  const [token, setToken] = useState<string>(storage?.getString('token') || '');
  const [loggedIn, setLoggedIn] = useState<boolean>(false);

  const logout = useCallback(() => {
    storage?.delete('token');
    setLoggedIn(false);
    setToken('');
  }, [storage]);

  return (
    <AuthContext.Provider
      value={{
        token,
        setToken,
        loggedIn,
        setLoggedIn,
        logout,
      }}>
      {children}
    </AuthContext.Provider>
  );
}
