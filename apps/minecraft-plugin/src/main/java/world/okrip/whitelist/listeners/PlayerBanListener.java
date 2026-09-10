package world.okrip.whitelist.listeners;
import org.bukkit.*;
import org.bukkit.ban.ProfileBanList;
import org.bukkit.event.*;
import org.bukkit.event.player.PlayerKickEvent;
import com.google.gson.JsonObject;
import java.util.*;
import java.util.concurrent.*;
import world.okrip.whitelist.commands.DeliveryJournal;
public final class PlayerBanListener implements Listener {
    private final DeliveryJournal journal;
    private final ScheduledExecutorService worker;
    private final Set<String> observed = ConcurrentHashMap.newKeySet();
    public PlayerBanListener(DeliveryJournal journal, ScheduledExecutorService worker) { this.journal = journal; this.worker = worker; }
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void kicked(PlayerKickEvent event) { scan(); }
    // Polling also catches vanilla bans of offline players; Paper has no universal ban event.
    public void scan() {
        ProfileBanList bans = Bukkit.getBanList(BanList.Type.PROFILE);
        Set<String> current = new HashSet<>();
        for (var ban : bans.getBanEntries()) {
            if (!(ban.getBanTarget() instanceof org.bukkit.profile.PlayerProfile profile)) continue;
            String name = profile.getName();
            if (name == null || !name.matches("[A-Za-z0-9_]{3,16}")) continue;
            String key = name.toLowerCase(Locale.ROOT); current.add(key);
            if ("OkripWorld".equals(ban.getSource()) || !observed.add(key)) continue;
            enqueue(name, "Minecraft server ban", key);
        }
        observed.retainAll(current);
    }
    public void enqueue(String username, String reason, String key) {
        worker.execute(() -> {
            String id = UUID.randomUUID().toString();
            JsonObject event = new JsonObject(); event.addProperty("eventId", id); event.addProperty("username", username); event.addProperty("reason", reason);
            try { journal.put("ban:" + id, "/v1/minecraft/events/ban", event); }
            catch (Exception error) { observed.remove(key); }
        });
    }
}
