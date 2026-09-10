package world.okrip.whitelist;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;
import world.okrip.whitelist.config.PluginConfig;
import world.okrip.whitelist.api.OkripApiClient;
import world.okrip.whitelist.commands.*;
import world.okrip.whitelist.listeners.PlayerBanListener;
import java.util.concurrent.*;
import java.util.Arrays;
public final class OkripWhitelistPlugin extends JavaPlugin {
    private ScheduledExecutorService worker;
    private long lastWarning;
    @Override public void onEnable() {
        saveDefaultConfig();
        try {
            PluginConfig config = PluginConfig.load(getConfig());
            DeliveryJournal journal = new DeliveryJournal(getDataFolder().toPath().resolve("delivery-journal.json"));
            OkripApiClient api = new OkripApiClient(config);
            CommandPoller poller = new CommandPoller(api, new CommandExecutor(this), new CommandAcknowledger(journal, api));
            worker = Executors.newSingleThreadScheduledExecutor(r -> { Thread t = new Thread(r, "OkripWhitelist-worker"); t.setDaemon(true); return t; });
            PlayerBanListener bans = new PlayerBanListener(journal, worker);
            Bukkit.getPluginManager().registerEvents(bans, this);
            Bukkit.getScheduler().runTaskTimer(this, bans::scan, 20L, 200L);
            getCommand("okripban").setExecutor((sender, command, label, args) -> {
                if (args.length < 2 || !args[0].matches("[A-Za-z0-9_]{3,16}")) return false;
                String reason = String.join(" ", Arrays.copyOfRange(args, 1, args.length));
                if (reason.length() > 256) { sender.sendMessage("Reason must be at most 256 characters."); return true; }
                bans.enqueue(args[0], reason, args[0].toLowerCase(java.util.Locale.ROOT));
                sender.sendMessage("Ban queued for API synchronization. Check console if access is not updated."); return true;
            });
            worker.scheduleWithFixedDelay(() -> {
                try { poller.tick(); } catch (Exception error) {
                    if (System.currentTimeMillis() - lastWarning > 60000) { getLogger().warning("Synchronization deferred; check API availability and configuration."); lastWarning = System.currentTimeMillis(); }
                }
            }, 0, config.interval(), TimeUnit.SECONDS);
        } catch (Exception error) { getLogger().severe("Plugin disabled: invalid configuration or unreadable delivery journal."); Bukkit.getPluginManager().disablePlugin(this); }
    }
    @Override public void onDisable() { Bukkit.getScheduler().cancelTasks(this); if (worker != null) worker.shutdownNow(); }
}
