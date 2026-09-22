export const queryKeys = {
  session: ["session"] as const,
  application: ["application", "current"] as const,
  adminApplicationsRoot: ["admin", "applications"] as const,
  adminApplications: (filter: string) =>
    ["admin", "applications", filter] as const,
  adminWhitelist: ["admin", "whitelist"] as const,
};
