import { contract } from "@Social_Media_App/api/index";
import { env } from "@Social_Media_App/env/native";
import { QueryClient } from "@tanstack/react-query";
import { initClient, tsRestFetchApi } from "@ts-rest/core";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60,
    },
  },
});

const clientArgs = {
  baseUrl: `${env.EXPO_PUBLIC_SERVER_URL}/rest`,
  baseHeaders: {},
  api: tsRestFetchApi,
};

const client = initClient(contract, clientArgs);

export const tsr = initTsrReactQuery(contract, clientArgs);
