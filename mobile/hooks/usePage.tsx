/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { BackHandler, StatusBar } from 'react-native';
import { mainColors } from '../assets/colors/mainColors';

export type Page = 'login' | 'conversation' | 'settings';

const PageContext = createContext<{
  page: Page;
  setPage: (page: Page) => void;
}>({
  page: 'login',
  setPage: () => {},
});

export const usePage = () => useContext(PageContext);

export function PageProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = React.useState<Page>('login');

  const [backHandler, setBackHandler] = useState<any>({
    handler: () => undefined,
  });

  useEffect(() => {
    StatusBar.setTranslucent(true);
    StatusBar.setBackgroundColor(mainColors.glass);

    if (backHandler?.handler) {
      BackHandler.removeEventListener('hardwareBackPress', backHandler.handler);
    }

    function newHandler() {
      if (page === 'settings') {
        setPage('conversation');
        return true;
      }
    }

    setBackHandler({ handler: newHandler });

    BackHandler.addEventListener('hardwareBackPress', newHandler);
  }, [page]);

  return (
    <PageContext.Provider value={{ page, setPage }}>
      {children}
    </PageContext.Provider>
  );
}
