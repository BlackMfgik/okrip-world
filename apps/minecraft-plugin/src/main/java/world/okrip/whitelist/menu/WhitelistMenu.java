package world.okrip.whitelist.menu;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.OfflinePlayer;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.SkullMeta;
import org.jetbrains.annotations.NotNull;
import world.okrip.whitelist.api.WhitelistEntry;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
/** Одна сторінка меню-скрині зі списком вайтліста. Стан меню живе в holder, тож кліки легко розпізнати. */
public final class WhitelistMenu implements InventoryHolder {
    static final int SLOT_PREVIOUS = 45, SLOT_REFRESH = 48, SLOT_INFO = 49, SLOT_CLOSE = 50, SLOT_NEXT = 53;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm").withZone(ZoneId.of("Europe/Kyiv"));

    private final List<WhitelistEntry> all;
    private final List<WhitelistEntry> visible;
    private final String query;
    private final int page;
    private final Inventory inventory;

    WhitelistMenu(List<WhitelistEntry> all, String query, int page) {
        this.all = all;
        this.query = query;
        this.visible = MenuPages.filter(all, query);
        this.page = MenuPages.clampPage(page, visible.size());
        int pages = MenuPages.pageCount(visible.size());
        inventory = Bukkit.createInventory(this, 54,
            Component.text("Вайтліст · " + (this.page + 1) + "/" + pages, NamedTextColor.DARK_GRAY));
        render(pages);
    }

    @Override public @NotNull Inventory getInventory() { return inventory; }
    List<WhitelistEntry> all() { return all; }
    String query() { return query; }
    int page() { return page; }

    /** Гравець у слоті або null, якщо слот не голова. */
    WhitelistEntry entryAt(int slot) {
        List<WhitelistEntry> current = MenuPages.page(visible, page);
        return slot >= 0 && slot < current.size() ? current.get(slot) : null;
    }
    boolean hasPrevious() { return page > 0; }
    boolean hasNext() { return page < MenuPages.pageCount(visible.size()) - 1; }

    /**
     * UUID, під яким гравець записаний на сервері. Для тих, хто вже заходив, — із кешу сервера;
     * в offline-mode його можна обчислити за ніком (так само, як при додаванні до вайтліста).
     */
    static UUID uuidFor(String username) {
        OfflinePlayer cached = Bukkit.getOfflinePlayerIfCached(username);
        if (cached != null) return cached.getUniqueId();
        if (!Bukkit.getOnlineMode())
            return UUID.nameUUIDFromBytes(("OfflinePlayer:" + username).getBytes(StandardCharsets.UTF_8));
        return null;
    }

    static String formatDate(WhitelistEntry entry) { return DATE.format(entry.addedAt()); }
    static String formatDate(java.time.Instant instant) { return DATE.format(instant); }

    private void render(int pages) {
        List<WhitelistEntry> current = MenuPages.page(visible, page);
        for (int slot = 0; slot < current.size(); slot++) inventory.setItem(slot, head(current.get(slot)));

        ItemStack filler = button(Material.GRAY_STAINED_GLASS_PANE, Component.empty(), List.of());
        for (int slot = 45; slot < 54; slot++) inventory.setItem(slot, filler);
        if (hasPrevious()) inventory.setItem(SLOT_PREVIOUS, button(Material.ARROW, text("← Попередня сторінка", NamedTextColor.YELLOW), List.of()));
        if (hasNext()) inventory.setItem(SLOT_NEXT, button(Material.ARROW, text("Наступна сторінка →", NamedTextColor.YELLOW), List.of()));
        inventory.setItem(SLOT_REFRESH, button(Material.CLOCK, text("Оновити", NamedTextColor.AQUA),
            List.of(text("Завантажити свіжий список з сайту", NamedTextColor.GRAY))));
        inventory.setItem(SLOT_CLOSE, button(Material.BARRIER, text("Закрити", NamedTextColor.RED), List.of()));

        List<Component> info = new ArrayList<>();
        info.add(line("Усього у вайтлісті", String.valueOf(all.size())));
        if (query != null && !query.isBlank()) {
            info.add(line("Пошук", query));
            info.add(line("Знайдено", String.valueOf(visible.size())));
        }
        info.add(line("Сторінка", (page + 1) + " / " + pages));
        info.add(Component.empty());
        info.add(text("Пошук: /wlmenu <нік, Discord або ID>", NamedTextColor.DARK_GRAY));
        inventory.setItem(SLOT_INFO, button(Material.BOOK, text("Вайтліст Okrip World", NamedTextColor.GOLD), info));

        if (visible.isEmpty()) inventory.setItem(22, button(Material.PAPER,
            text(all.isEmpty() ? "Вайтліст порожній" : "Нікого не знайдено", NamedTextColor.GRAY), List.of()));
    }

    private static ItemStack head(WhitelistEntry entry) {
        UUID uuid = uuidFor(entry.username());
        boolean online = Bukkit.getPlayerExact(entry.username()) != null;
        ItemStack item = new ItemStack(Material.PLAYER_HEAD);
        item.editMeta(SkullMeta.class, meta -> {
            if (uuid != null) meta.setPlayerProfile(Bukkit.createProfile(uuid, entry.username()));
            meta.displayName(text(entry.username(), online ? NamedTextColor.GREEN : NamedTextColor.WHITE).decorate(TextDecoration.BOLD));
            String discord = entry.discordDisplayName() == null
                ? "@" + entry.discordUsername()
                : entry.discordDisplayName() + " (@" + entry.discordUsername() + ")";
            meta.lore(List.of(
                line("Discord", discord),
                line("Discord ID", entry.discordId()),
                line("UUID", uuid == null ? "ще не заходив" : uuid.toString()),
                line("Додано", formatDate(entry)),
                online ? text("● Онлайн", NamedTextColor.GREEN) : text("● Офлайн", NamedTextColor.DARK_GRAY),
                Component.empty(),
                text("Клік — надіслати дані в чат для копіювання", NamedTextColor.YELLOW)));
        });
        return item;
    }

    static ItemStack button(Material material, Component name, List<Component> lore) {
        ItemStack item = new ItemStack(material);
        item.editMeta(meta -> { meta.displayName(name); meta.lore(lore); });
        return item;
    }

    static Component text(String value, NamedTextColor color) {
        return Component.text(value, color).decoration(TextDecoration.ITALIC, false);
    }

    static Component line(String label, String value) {
        return text(label + ": ", NamedTextColor.GRAY).append(text(value, NamedTextColor.WHITE));
    }
}
