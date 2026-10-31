"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Без "always" офлайн-запит чекає мережі без жодного повідомлення,
          // а дія адміністратора виконалася б сама після відновлення зв'язку.
          queries: {
            networkMode: "always",
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: { networkMode: "always" },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
