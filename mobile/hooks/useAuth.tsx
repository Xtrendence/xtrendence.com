import React, {
  Dispatch,
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

const AuthContext = createContext<{
  token: string | undefined;
  loggedIn: boolean;
  setLoggedIn: Dispatch<React.SetStateAction<boolean>>;
}>({
  token: undefined,
  loggedIn: false,
  setLoggedIn: () => undefined,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string>();
  const [loggedIn, setLoggedIn] = useState<boolean>(false);

  const fetchToken = useCallback(async () => {
    setToken('testingalongtoken');
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  return (
    <AuthContext.Provider
      value={{
        token,
        loggedIn,
        setLoggedIn,
      }}>
      {children}
    </AuthContext.Provider>
  );
}
