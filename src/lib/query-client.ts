import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { del, get, set } from "idb-keyval";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30s fresh window; instant render from IDB cache + quiet revalidate
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  });
}

export function createIdbPersister() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return createAsyncStoragePersister({
    key: "resker-query-cache-v1",
    storage: {
      getItem: async (key) => {
        const val = await get<string>(key);
        return val ?? null;
      },
      setItem: async (key, value) => {
        await set(key, value);
      },
      removeItem: async (key) => {
        await del(key);
      },
    },
  });
}
