export type CommandSignalListener = () => void;

export class MinecraftCommandSignals {
  private readonly listeners = new Map<string, Set<CommandSignalListener>>();

  subscribe(serverId: string, listener: CommandSignalListener) {
    const listeners = this.listeners.get(serverId) ?? new Set();
    listeners.add(listener);
    this.listeners.set(serverId, listeners);

    return () => {
      listeners.delete(listener);
      if (!listeners.size) this.listeners.delete(serverId);
    };
  }

  notify(serverId: string) {
    for (const listener of this.listeners.get(serverId) ?? []) listener();
  }
}
