import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const normalizedBasepath = (() => {
  const baseUrl = import.meta.env.BASE_URL;
  if (!baseUrl || baseUrl === './' || baseUrl === '/') return undefined;
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
})();

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(normalizedBasepath ? { basepath: normalizedBasepath } : {}),
  });

  return router;
};
