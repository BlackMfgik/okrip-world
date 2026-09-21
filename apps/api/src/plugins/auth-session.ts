import type { FastifyRequest } from "fastify";
import type { AuthService } from "../modules/auth/auth.service.js";
import { AppError } from "../shared/errors.js";
export const sessionCookie = "okrip_session";
export async function requireUser(auth: AuthService, request: FastifyRequest) {
  const user = await auth.current(request.cookies[sessionCookie]);
  if (!user) throw new AppError(401, "unauthorized", "Увійдіть через Discord.");
  return user;
}

export async function requireAdmin(auth: AuthService, request: FastifyRequest) {
  const user = await requireUser(auth, request);
  if (!(await auth.isAdmin(user.discordId)))
    throw new AppError(403, "forbidden", "Недостатньо прав.");
  return user;
}
