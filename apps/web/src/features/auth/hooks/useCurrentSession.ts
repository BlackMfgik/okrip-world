"use client";
import { useQuery } from "@tanstack/react-query";
import { sessionSchema } from "@okrip/contracts";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
export const useCurrentSession = () =>
  useQuery({
    queryKey: queryKeys.session,
    queryFn: () => apiRequest("/me", sessionSchema),
    retry: false,
  });
