package world.okrip.whitelist;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;
import world.okrip.whitelist.config.PluginConfig;
import world.okrip.whitelist.api.OkripApiClient;
import world.okrip.whitelist.commands.*;
import world.okrip.whitelist.listeners.PlayerBanListener;
import world.okrip.whitelist.menu.UnbanController;
import world.okrip.whitelist.menu.WhitelistMenuController;
import java.nio.file.Path;
import java.util.concurrent.*;
import java.util.Arrays;
public final class OkripWhitelistPlugin extends JavaPlugin {
    private ScheduledExecutorService worker;
    private CommandWatcher watcher;
    private long lastWarning;
    @Override public void onEnable() {
        saveDefaultConfig();
        PluginConfig config;
        try {
            config = PluginConfig.load(getConfig());
            getLogger().info("Configuration valid: api-url=" + config.apiUrl() + ", server-id=" + config.serverId()
                + ", timeout-seconds=" + config.timeout() + ", server-token=[hidden].");
        } catch (Exception error) {
            disable("Configuration error: " + detail(error));
            return;
        }

        Path journalPath = getDataFolder().toPath().resolve("delivery-journal.json");
        DeliveryJournal journal;
        try {
            journal = new DeliveryJournal(journalPath);
            getLogger().info("Delivery journal valid: " + journalPath + " (" + journal.snapshot().size() + " pending entries).");
        } catch (Exception error) {
            disable("Delivery journal error: " + detail(error)
                + ". Check that plugins/OkripWhitelist is readable and writable.");
            return;
        }

        try {
            OkripApiClient api = new OkripApiClient(config);
            CommandExecutor executor = new CommandExecutor(this);
            CommandPoller poller = new CommandPoller(api, executor, new CommandAcknowledger(journal, api), getLogger());
            worker = Executors.newSingleThreadScheduledExecutor(r -> { Thread t = new Thread(r, "OkripWhitelist-worker"); t.setDaemon(true); return t; });
            watcher = new CommandWatcher(api, poller, worker, error -> {
                if (System.currentTimeMillis() - lastWarning > 60000) {
                    getLogger().warning("Synchronization deferred: " + detail(error));
                    lastWarning = System.currentTimeMillis();
                }
            });
            PlayerBanListener bans = new PlayerBanListener(journal, worker, watcher::signal);
            Bukkit.getPluginManager().registerEvents(bans, this);
            Bukkit.getScheduler().runTaskTimer(this, bans::scan, 20L, 200L);
            getCommand("wlban").setExecutor((sender, command, label, args) -> {
                if (args.length < 2 || !args[0].matches("[A-Za-z0-9_]{3,16}")) return false;
                String reason = String.join(" ", Arrays.copyOfRange(args, 1, args.length));
                if (reason.length() > 256) { sender.sendMessage("Reason must be at most 256 characters."); return true; }
                bans.enqueue(args[0], reason, args[0].toLowerCase(java.util.Locale.ROOT));
                sender.sendMessage("Ban queued for API synchronization. Check console if access is not updated."); return true;
            });
            getCommand("okripwhitelist").setExecutor((sender, command, label, args) -> {
                if (args.length != 1 || !"validate".equalsIgnoreCase(args[0])) return false;
                try {
                    reloadConfig();
                    PluginConfig checked = PluginConfig.load(getConfig());
                    DeliveryJournal checkedJournal = new DeliveryJournal(journalPath);
                    int localCount = Bukkit.getWhitelistedPlayers().size();
                    sender.sendMessage("OkripWhitelist: local checks passed; checking API snapshot...");
                    worker.execute(() -> {
                        try {
                            int apiCount = new OkripApiClient(checked).activeWhitelist().size();
                            Bukkit.getScheduler().runTask(this, () -> sender.sendMessage(
                                "OkripWhitelist validation passed: API=" + checked.apiUrl() + ", server=" + checked.serverId()
                                    + ", journal-pending=" + checkedJournal.snapshot().size() + ", snapshot=" + apiCount
                                    + ", local-whitelist=" + localCount + ", difference=" + (apiCount - localCount) + "."));
                        } catch (Exception error) {
                            Bukkit.getScheduler().runTask(this, () -> sender.sendMessage(
                                "OkripWhitelist API validation failed: " + detail(error)));
                        }
                    });
                } catch (Exception error) {
                    sender.sendMessage("OkripWhitelist validation failed: " + detail(error));
                }
                return true;
            });
            WhitelistMenuController menu = new WhitelistMenuController(this, api, OkripWhitelistPlugin::detail);
            Bukkit.getPluginManager().registerEvents(menu, this);
            getCommand("wlmenu").setExecutor((sender, command, label, args) -> menu.onCommand(sender, args));
            WhitelistRemoveCommand remove = new WhitelistRemoveCommand(this, api, OkripWhitelistPlugin::detail);
            getCommand("wldel").setExecutor((sender, command, label, args) -> remove.onCommand(sender, args));
            // Підказки ніків із вайтліста сервера для /wldel і /wlban (перший аргумент).
            org.bukkit.command.TabCompleter whitelistNames = (sender, command, label, args) -> {
                if (args.length != 1) return java.util.List.of();
                String prefix = args[0].toLowerCase(java.util.Locale.ROOT);
                return Bukkit.getWhitelistedPlayers().stream().map(org.bukkit.OfflinePlayer::getName)
                    .filter(name -> name != null && name.toLowerCase(java.util.Locale.ROOT).startsWith(prefix)).sorted().toList();
            };
            getCommand("wldel").setTabCompleter(whitelistNames);
            UnbanController unban = new UnbanController(this, api, OkripWhitelistPlugin::detail);
            Bukkit.getPluginManager().registerEvents(unban, this);
            getCommand("wlunban").setExecutor((sender, command, label, args) -> unban.onCommand(sender, args));
            getCommand("wlunban").setTabCompleter((sender, command, label, args) -> args.length == 1
                ? unban.bannedNames(args[0]) : args.length == 2 ? java.util.List.of("wl") : java.util.List.of());
            getCommand("wlban").setTabCompleter(whitelistNames);
            watcher.start();
            worker.scheduleWithFixedDelay(() -> {
                try {
                    for (String username : api.activeWhitelist()) executor.ensureWhitelisted(username);
                } catch (Exception error) {
                    if (System.currentTimeMillis() - lastWarning > 60000) {
                        getLogger().warning("Whitelist reconciliation deferred: " + detail(error));
                        lastWarning = System.currentTimeMillis();
                    }
                }
            }, 0, 5, TimeUnit.MINUTES);
        } catch (Exception error) {
            disable("Plugin startup error: " + detail(error));
        }
    }
    @Override public void onDisable() { Bukkit.getScheduler().cancelTasks(this); if (watcher != null) watcher.close(); if (worker != null) worker.shutdownNow(); }
    private void disable(String message) {
        getLogger().severe(message);
        Bukkit.getPluginManager().disablePlugin(this);
    }
    private static String detail(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null) current = current.getCause();
        return current.getMessage() == null ? current.getClass().getSimpleName() : current.getMessage();
    }
}
