import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Lights } from "./components/Lights";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Lights />
    </QueryClientProvider>
  );
}

export default App;
