package world.okrip.whitelist.menu;
import org.bukkit.BanList;
import org.bukkit.Bukkit;
import org.bukkit.ban.ProfileBanList;
import org.bukkit.profile.PlayerProfile;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
/** Запис зі списку банів сервера (ProfileBanList) для меню /wlunban. */
record BanRecord(String username, UUID uuid, String reason, String source, Instant created, Instant expires) {
    /** Знімок банів сервера, найновіші першими. Лише з головного потоку. */
    @SuppressWarnings("deprecation") // getBanEntries() — єдиний спосіб отримати записи з профілями в Paper 1.21.
    static List<BanRecord> snapshot() {
        ProfileBanList bans = Bukkit.getBanList(BanList.Type.PROFILE);
        List<BanRecord> records = new ArrayList<>();
        for (var ban : bans.getBanEntries()) {
            if (!(ban.getBanTarget() instanceof PlayerProfile profile)) continue;
            String name = profile.getName();
            if (name == null || !name.matches("[A-Za-z0-9_]{3,16}")) continue;
            records.add(new BanRecord(name, profile.getUniqueId(), ban.getReason(), ban.getSource(),
                ban.getCreated() == null ? null : ban.getCreated().toInstant(),
                ban.getExpiration() == null ? null : ban.getExpiration().toInstant()));
        }
        records.sort(Comparator.comparing(BanRecord::created, Comparator.nullsLast(Comparator.reverseOrder())));
        return records;
    }

    /** Знімає локальний бан сервера за ніком (без урахування регістру). true — бан був. Лише з головного потоку. */
    @SuppressWarnings("deprecation")
    static boolean pardon(String username) {
        ProfileBanList bans = Bukkit.getBanList(BanList.Type.PROFILE);
        boolean removed = false;
        for (var ban : bans.getBanEntries()) {
            if (ban.getBanTarget() instanceof PlayerProfile profile
                && profile.getName() != null
                && profile.getName().toLowerCase(Locale.ROOT).equals(username.toLowerCase(Locale.ROOT))) {
                ban.remove();
                removed = true;
            }
        }
        return removed;
    }
}
