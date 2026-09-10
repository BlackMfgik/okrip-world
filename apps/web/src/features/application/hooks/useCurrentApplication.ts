"use client";
import { useQuery } from "@tanstack/react-query";
import { currentApplicationSchema } from "@okrip/contracts";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
export const useCurrentApplication = (enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.application,
    queryFn: () =>
      apiRequest("/applications/current", currentApplicationSchema),
    enabled,
    refetchInterval: 5000,
  });
