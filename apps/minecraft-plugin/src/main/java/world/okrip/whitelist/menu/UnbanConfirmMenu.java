package world.okrip.whitelist.menu;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.jetbrains.annotations.NotNull;
import java.util.List;
import static world.okrip.whitelist.menu.WhitelistMenu.button;
import static world.okrip.whitelist.menu.WhitelistMenu.text;
/** Підтвердження розбану: лише зняти бан або зняти й повернути у вайтліст. */
final class UnbanConfirmMenu implements InventoryHolder {
    static final int SLOT_UNBAN = 11, SLOT_HEAD = 13, SLOT_UNBAN_WHITELIST = 15, SLOT_BACK = 22;

    private final BanRecord ban;
    private final int returnPage;
    private final Inventory inventory;

    UnbanConfirmMenu(BanRecord ban, int returnPage) {
        this.ban = ban;
        this.returnPage = returnPage;
        inventory = Bukkit.createInventory(this, 27, Component.text("Розбан · " + ban.username(), NamedTextColor.DARK_GRAY));
        ItemStack filler = button(Material.GRAY_STAINED_GLASS_PANE, Component.empty(), List.of());
        for (int slot = 0; slot < 27; slot++) inventory.setItem(slot, filler);
        inventory.setItem(SLOT_HEAD, BanListMenu.head(ban, false));
        inventory.setItem(SLOT_UNBAN, button(Material.LIME_CONCRETE, text("Розбанити", NamedTextColor.GREEN), List.of(
            text("Бан знімається на сервері й на сайті.", NamedTextColor.GRAY),
            text("У вайтліст гравець не повертається:", NamedTextColor.GRAY),
            text("додати можна пізніше в адмінці сайту.", NamedTextColor.GRAY))));
        inventory.setItem(SLOT_UNBAN_WHITELIST, button(Material.EMERALD_BLOCK, text("Розбанити й повернути у вайтліст", NamedTextColor.AQUA), List.of(
            text("Бан знімається, доступ на сайті відновлюється,", NamedTextColor.GRAY),
            text("гравець знову може заходити на сервер.", NamedTextColor.GRAY))));
        inventory.setItem(SLOT_BACK, button(Material.ARROW, text("← Назад до списку", NamedTextColor.YELLOW), List.of()));
    }

    @Override public @NotNull Inventory getInventory() { return inventory; }
    BanRecord ban() { return ban; }
    int returnPage() { return returnPage; }
}
