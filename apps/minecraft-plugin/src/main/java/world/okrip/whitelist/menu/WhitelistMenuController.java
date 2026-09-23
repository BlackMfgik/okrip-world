package world.okrip.whitelist.menu;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.event.HoverEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.plugin.java.JavaPlugin;
import world.okrip.whitelist.api.OkripApiClient;
import world.okrip.whitelist.api.WhitelistEntry;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
/** Команда /wlmenu і обробка кліків у меню вайтліста. */
public final class WhitelistMenuController implements Listener {
    private final JavaPlugin plugin;
    private final OkripApiClient api;
    private final Function<Throwable, String> describe;

    public WhitelistMenuController(JavaPlugin plugin, OkripApiClient api, Function<Throwable, String> describe) {
        this.plugin = plugin;
        this.api = api;
        this.describe = describe;
    }

    public boolean onCommand(CommandSender sender, String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("Меню доступне лише гравцям. У консолі використовуйте /okripwhitelist validate.");
            return true;
        }
        load(player, args.length == 0 ? null : String.join(" ", args), 0);
        return true;
    }

    /** Запит до API — поза головним потоком, відкриття меню — у ньому. */
    private void load(Player player, String query, int page) {
        player.sendMessage(Component.text("Завантажуємо вайтліст…", NamedTextColor.GRAY));
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                List<WhitelistEntry> entries = api.whitelistPlayers();
                Bukkit.getScheduler().runTask(plugin, () -> {
                    if (player.isOnline()) player.openInventory(new WhitelistMenu(entries, query, page).getInventory());
                });
            } catch (Exception error) {
                if (error instanceof InterruptedException) Thread.currentThread().interrupt();
                plugin.getLogger().warning("Whitelist menu request failed: " + describe.apply(error));
                Bukkit.getScheduler().runTask(plugin, () -> player.sendMessage(
                    Component.text("Не вдалося завантажити вайтліст: " + describe.apply(error), NamedTextColor.RED)));
            }
        });
    }

    @EventHandler public void onClick(InventoryClickEvent event) {
        if (!(event.getView().getTopInventory().getHolder(false) instanceof WhitelistMenu menu)) return;
        // Меню лише для перегляду: предмети не можна забрати чи підкласти, зокрема shift-кліком.
        event.setCancelled(true);
        if (!(event.getWhoClicked() instanceof Player player) || event.getClickedInventory() != event.getView().getTopInventory()) return;
        int slot = event.getRawSlot();
        switch (slot) {
            case WhitelistMenu.SLOT_PREVIOUS -> { if (menu.hasPrevious()) open(player, menu, menu.page() - 1); }
            case WhitelistMenu.SLOT_NEXT -> { if (menu.hasNext()) open(player, menu, menu.page() + 1); }
            case WhitelistMenu.SLOT_REFRESH -> { player.closeInventory(); load(player, menu.query(), menu.page()); }
            case WhitelistMenu.SLOT_CLOSE -> player.closeInventory();
            default -> {
                WhitelistEntry entry = menu.entryAt(slot);
                if (entry != null) sendDetails(player, entry);
            }
        }
    }

    @EventHandler public void onDrag(InventoryDragEvent event) {
        if (event.getView().getTopInventory().getHolder(false) instanceof WhitelistMenu) event.setCancelled(true);
    }

    private void open(Player player, WhitelistMenu menu, int page) {
        // Відкривати інше вікно всередині обробника кліку небезпечно — робимо це наступним тіком.
        Bukkit.getScheduler().runTask(plugin, () -> player.openInventory(new WhitelistMenu(menu.all(), menu.query(), page).getInventory()));
    }

    private static void sendDetails(Player player, WhitelistEntry entry) {
        UUID uuid = WhitelistMenu.uuidFor(entry.username());
        player.sendMessage(Component.text("── " + entry.username() + " ──", NamedTextColor.GOLD));
        player.sendMessage(copyable("Нік", entry.username()));
        player.sendMessage(copyable("Discord", "@" + entry.discordUsername()));
        player.sendMessage(copyable("Discord ID", entry.discordId()));
        player.sendMessage(uuid == null
            ? Component.text("UUID: ", NamedTextColor.GRAY).append(Component.text("ще не заходив", NamedTextColor.WHITE))
            : copyable("UUID", uuid.toString()));
        player.sendMessage(Component.text("Додано: ", NamedTextColor.GRAY)
            .append(Component.text(WhitelistMenu.formatDate(entry), NamedTextColor.WHITE)));
    }

    private static Component copyable(String label, String value) {
        return Component.text(label + ": ", NamedTextColor.GRAY)
            .append(Component.text(value, NamedTextColor.WHITE)
                .clickEvent(ClickEvent.copyToClipboard(value))
                .hoverEvent(HoverEvent.showText(Component.text("Натисніть, щоб скопіювати", NamedTextColor.YELLOW))))
            .append(Component.text(" [копіювати]", NamedTextColor.DARK_GRAY)
                .clickEvent(ClickEvent.copyToClipboard(value)));
    }
}
