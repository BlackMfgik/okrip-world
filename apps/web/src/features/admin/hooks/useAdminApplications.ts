"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminApplicationBlockResultSchema,
  adminApplicationListSchema,
  adminDecisionResultSchema,
  type AdminApplicationFilter,
  type AdminApplicationBlock,
  type AdminDecision,
} from "@okrip/contracts";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
export type BlockConfirmation = AdminApplicationBlock & {
  minecraftUsername: string;
};

export function useAdminApplications(active: boolean) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<AdminApplicationFilter>("pending");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [blockConfirmation, setBlockConfirmation] =
    useState<BlockConfirmation | null>(null);
  const [approveConfirmation, setApproveConfirmation] = useState<{
    publicId: string;
    minecraftUsername: string;
  } | null>(null);
  const applications = useQuery({
    queryKey: queryKeys.adminApplications(filter),
    queryFn: () =>
      apiRequest(
        `/admin/applications?status=${filter}`,
        adminApplicationListSchema,
      ),
    enabled: active,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const decision = useMutation({
    mutationFn: (body: AdminDecision) =>
      apiRequest(
        "/admin/applications/decision",
        adminDecisionResultSchema,
        body,
      ),
    onSuccess: async () => {
      setRejecting(null);
      setReason("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.adminApplicationsRoot,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminWhitelist }),
      ]);
    },
  });

  const applicationBlock = useMutation({
    mutationFn: (body: AdminApplicationBlock) =>
      apiRequest(
        "/admin/applications/block",
        adminApplicationBlockResultSchema,
        body,
      ),
    onSuccess: async () => {
      setBlockConfirmation(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminApplicationsRoot,
      });
    },
  });

  return {
    filter,
    setFilter,
    rejecting,
    setRejecting,
    reason,
    setReason,
    blockConfirmation,
    setBlockConfirmation,
    approveConfirmation,
    setApproveConfirmation,
    applications,
    decision,
    applicationBlock,
  };
}
