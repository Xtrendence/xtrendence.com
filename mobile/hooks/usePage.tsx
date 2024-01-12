import React, { ReactNode, createContext, useContext } from 'react';

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

  return (
    <PageContext.Provider value={{ page, setPage }}>
      {children}
    </PageContext.Provider>
  );
}
