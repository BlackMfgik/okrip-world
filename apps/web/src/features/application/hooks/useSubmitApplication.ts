"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  currentApplicationSchema,
  type SubmitApplication,
} from "@okrip/contracts";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
export function useSubmitApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitApplication) =>
      apiRequest("/applications", currentApplicationSchema, body),
    onSuccess: (data) => client.setQueryData(queryKeys.application, data),
  });
}
