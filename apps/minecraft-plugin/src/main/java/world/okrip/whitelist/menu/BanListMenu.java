package world.okrip.whitelist.menu;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.SkullMeta;
import org.jetbrains.annotations.NotNull;
import java.util.ArrayList;
import java.util.List;
import static world.okrip.whitelist.menu.WhitelistMenu.button;
import static world.okrip.whitelist.menu.WhitelistMenu.formatDate;
import static world.okrip.whitelist.menu.WhitelistMenu.line;
import static world.okrip.whitelist.menu.WhitelistMenu.text;
/** Меню /wlunban: забанені гравці сервера, клік відкриває підтвердження розбану. */
final class BanListMenu implements InventoryHolder {
    static final int SLOT_PREVIOUS = 45, SLOT_REFRESH = 48, SLOT_INFO = 49, SLOT_CLOSE = 50, SLOT_NEXT = 53;

    private final List<BanRecord> bans;
    private final int page;
    private final Inventory inventory;

    BanListMenu(List<BanRecord> bans, int page) {
        this.bans = bans;
        this.page = MenuPages.clampPage(page, bans.size());
        int pages = MenuPages.pageCount(bans.size());
        inventory = Bukkit.createInventory(this, 54,
            Component.text("Бани · " + (this.page + 1) + "/" + pages, NamedTextColor.DARK_GRAY));
        render(pages);
    }

    @Override public @NotNull Inventory getInventory() { return inventory; }
    int page() { return page; }
    boolean hasPrevious() { return page > 0; }
    boolean hasNext() { return page < MenuPages.pageCount(bans.size()) - 1; }

    BanRecord banAt(int slot) {
        List<BanRecord> current = MenuPages.page(bans, page);
        return slot >= 0 && slot < current.size() ? current.get(slot) : null;
    }

    private void render(int pages) {
        List<BanRecord> current = MenuPages.page(bans, page);
        for (int slot = 0; slot < current.size(); slot++) inventory.setItem(slot, head(current.get(slot), true));

        ItemStack filler = button(Material.GRAY_STAINED_GLASS_PANE, Component.empty(), List.of());
        for (int slot = 45; slot < 54; slot++) inventory.setItem(slot, filler);
        if (hasPrevious()) inventory.setItem(SLOT_PREVIOUS, button(Material.ARROW, text("← Попередня сторінка", NamedTextColor.YELLOW), List.of()));
        if (hasNext()) inventory.setItem(SLOT_NEXT, button(Material.ARROW, text("Наступна сторінка →", NamedTextColor.YELLOW), List.of()));
        inventory.setItem(SLOT_REFRESH, button(Material.CLOCK, text("Оновити", NamedTextColor.AQUA), List.of()));
        inventory.setItem(SLOT_CLOSE, button(Material.BARRIER, text("Закрити", NamedTextColor.RED), List.of()));
        inventory.setItem(SLOT_INFO, button(Material.BOOK, text("Бани сервера", NamedTextColor.GOLD), List.of(
            line("Забанено", String.valueOf(bans.size())),
            line("Сторінка", (page + 1) + " / " + pages),
            Component.empty(),
            text("Клік по гравцю — розбан", NamedTextColor.DARK_GRAY))));
        if (bans.isEmpty()) inventory.setItem(22, button(Material.PAPER, text("Забанених гравців немає", NamedTextColor.GRAY), List.of()));
    }

    /** Голова гравця з деталями бану; також використовується в меню підтвердження. */
    static ItemStack head(BanRecord ban, boolean withHint) {
        ItemStack item = new ItemStack(Material.PLAYER_HEAD);
        item.editMeta(SkullMeta.class, meta -> {
            if (ban.uuid() != null) meta.setPlayerProfile(Bukkit.createProfile(ban.uuid(), ban.username()));
            meta.displayName(text(ban.username(), NamedTextColor.RED).decorate(TextDecoration.BOLD));
            List<Component> lore = new ArrayList<>();
            lore.add(line("Причина", ban.reason() == null || ban.reason().isBlank() ? "не вказано" : ban.reason()));
            lore.add(line("Забанив", ban.source() == null ? "невідомо" : ban.source()));
            if (ban.created() != null) lore.add(line("Дата", formatDate(ban.created())));
            lore.add(line("До", ban.expires() == null ? "назавжди" : formatDate(ban.expires())));
            if (withHint) {
                lore.add(Component.empty());
                lore.add(text("Клік — розбанити", NamedTextColor.YELLOW));
            }
            meta.lore(lore);
        });
        return item;
    }
}
