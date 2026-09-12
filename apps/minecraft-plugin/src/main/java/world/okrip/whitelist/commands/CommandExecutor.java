package world.okrip.whitelist.commands;
import org.bukkit.*;
import org.bukkit.ban.ProfileBanList;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.profile.PlayerProfile;
import net.kyori.adventure.text.Component;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.*;
public final class CommandExecutor {
    private final JavaPlugin plugin;
    private final boolean onlineMode;
    public CommandExecutor(JavaPlugin plugin) { this.plugin = plugin; onlineMode = Bukkit.getOnlineMode(); }
    public void ensureWhitelisted(String username) throws Exception {
        Command command = new Command("reconcile", "reconcile", "whitelist_add", username, "");
        String failure = execute(command, System.nanoTime() + TimeUnit.SECONDS.toNanos(30));
        if (failure != null) throw new IllegalStateException(failure);
    }
    public String execute(Command command, long deadline) throws Exception {
        // Profile completion may perform HTTPS; this method is invoked by the dedicated worker.
        PlayerProfile profile;
        if (onlineMode) {
            profile = Bukkit.createPlayerProfile(command.username()).update().get(10, TimeUnit.SECONDS);
            if (profile.getUniqueId() == null || !profile.isComplete()) throw new IllegalStateException("Unresolved profile");
        } else {
            UUID uuid = UUID.nameUUIDFromBytes(("OfflinePlayer:" + command.username()).getBytes(StandardCharsets.UTF_8));
            profile = Bukkit.createPlayerProfile(uuid, command.username());
        }
        PlayerProfile resolved = profile;
        Future<String> mutation = Bukkit.getScheduler().callSyncMethod(plugin, () -> {
            if (System.nanoTime() >= deadline) throw new IllegalStateException("Execution deadline expired");
            return mutate(command, resolved);
        });
        try { return mutation.get(10, TimeUnit.SECONDS); }
        catch (TimeoutException error) { mutation.cancel(false); throw error; }
    }
    private String mutate(Command command, PlayerProfile profile) {
        // Resolve by name so Paper keeps both the UUID and username when it
        // serializes whitelist.json. Resolving only by UUID creates a nameless
        // entry that hosting panels classify as an unverified player.
        OfflinePlayer player = Bukkit.getOfflinePlayer(command.username());
        ProfileBanList bans = Bukkit.getBanList(BanList.Type.PROFILE);
        switch (command.type()) {
            case "whitelist_add" -> { if (bans.isBanned(profile)) return "local_ban"; if (!player.isWhitelisted()) player.setWhitelisted(true); }
            case "whitelist_remove" -> { if (player.isWhitelisted()) player.setWhitelisted(false); }
            case "kick" -> { var online = Bukkit.getPlayer(profile.getUniqueId()); if (online != null) online.kick(Component.text(command.reason())); }
            case "ban" -> {
                if (player.isWhitelisted()) player.setWhitelisted(false);
                if (!bans.isBanned(profile)) bans.addBan(profile, command.reason(), (java.util.Date) null, "OkripWorld");
                var online = Bukkit.getPlayer(profile.getUniqueId()); if (online != null) online.kick(Component.text(command.reason()));
            }
            default -> throw new IllegalArgumentException("Unknown command");
        }
        return null;
    }
}
