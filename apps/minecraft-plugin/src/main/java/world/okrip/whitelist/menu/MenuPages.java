package world.okrip.whitelist.menu;
import java.util.List;
import java.util.Locale;
import world.okrip.whitelist.api.WhitelistEntry;
/** Пошук і посторінковий поділ списку вайтліста (без залежностей від Bukkit). */
public final class MenuPages {
    /** 5 рядків скрині під голови, шостий — кнопки. */
    public static final int PER_PAGE = 45;
    private MenuPages() {}

    /** Збіг без урахування регістру за ніком, Discord-ніком, відображуваним ім'ям або Discord ID. */
    public static List<WhitelistEntry> filter(List<WhitelistEntry> entries, String query) {
        if (query == null || query.isBlank()) return entries;
        String needle = query.trim().toLowerCase(Locale.ROOT);
        return entries.stream().filter(entry ->
            entry.username().toLowerCase(Locale.ROOT).contains(needle)
                || entry.discordUsername().toLowerCase(Locale.ROOT).contains(needle)
                || (entry.discordDisplayName() != null && entry.discordDisplayName().toLowerCase(Locale.ROOT).contains(needle))
                || entry.discordId().equals(needle)).toList();
    }

    public static int pageCount(int total) {
        return Math.max(1, (total + PER_PAGE - 1) / PER_PAGE);
    }

    public static int clampPage(int page, int total) {
        return Math.max(0, Math.min(page, pageCount(total) - 1));
    }

    public static <T> List<T> page(List<T> items, int page) {
        int from = clampPage(page, items.size()) * PER_PAGE;
        return items.subList(from, Math.min(items.size(), from + PER_PAGE));
    }
}
