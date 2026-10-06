import type { Transaction } from "../../db/client.js";
import { enqueueCommand } from "../command-queue/index.js";
import * as repo from "./player-access.repository.js";

// Викликається всередині транзакції заявки: доступ і команда зберігаються атомарно.
export async function grantApprovedAccess(
  tx: Transaction,
  input: {
    userId: string;
    identityId: string;
    username: string;
    serverId: string;
  },
) {
  const existing = await repo.accessForIdentity(tx, input.identityId);
  const access = !existing
    ? await repo.grant(tx, input.userId, input.identityId)
    : existing.status === "revoked"
      ? await repo.reactivate(tx, existing.id)
      : existing;
  await enqueueCommand(
    tx,
    access.id,
    input.serverId,
    input.username,
    "whitelist_add",
  );
  return access;
}

export const restoreAccess = (tx: Transaction, accessId: string) =>
  repo.reactivate(tx, accessId);
