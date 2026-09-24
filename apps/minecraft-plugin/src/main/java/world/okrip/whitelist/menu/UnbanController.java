package world.okrip.whitelist.menu;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.plugin.java.JavaPlugin;
import world.okrip.whitelist.api.OkripApiClient;
import java.util.List;
import java.util.Locale;
import java.util.function.Function;
/**
 * /wlunban: меню банів і розбан. Спершу знімається локальний бан сервера (інакше whitelist_add
 * від API відмовив би з local_ban), потім API переводить доступ banned → revoked або → active.
 */
public final class UnbanController implements Listener {
    private final JavaPlugin plugin;
    private final OkripApiClient api;
    private final Function<Throwable, String> describe;

    public UnbanController(JavaPlugin plugin, OkripApiClient api, Function<Throwable, String> describe) {
        this.plugin = plugin;
        this.api = api;
        this.describe = describe;
    }

    /** /wlunban — меню; /wlunban &lt;нік&gt; — підтвердження (з консолі — одразу розбан); /wlunban &lt;нік&gt; wl — розбан і повернення у вайтліст. */
    public boolean onCommand(CommandSender sender, String[] args) {
        if (args.length > 2 || (args.length >= 1 && !args[0].matches("[A-Za-z0-9_]{3,16}"))
            || (args.length == 2 && !"wl".equalsIgnoreCase(args[1]))) return false;
        if (args.length == 0) {
            if (!(sender instanceof Player player)) {
                sender.sendMessage("Меню доступне лише гравцям. З консолі: /wlunban <нік> [wl]");
                return true;
            }
            player.openInventory(new BanListMenu(BanRecord.snapshot(), 0).getInventory());
            return true;
        }
        if (args.length == 2) { unban(sender, args[0], true); return true; }
        if (sender instanceof Player player) {
            BanRecord ban = BanRecord.snapshot().stream()
                .filter(record -> record.username().equalsIgnoreCase(args[0])).findFirst()
                // Бану на сервері немає, але він може лишитися на сайті — все одно даємо підтвердити.
                .orElse(new BanRecord(args[0], null, null, null, null, null));
            player.openInventory(new UnbanConfirmMenu(ban, 0).getInventory());
        } else {
            unban(sender, args[0], false);
        }
        return true;
    }

    public List<String> bannedNames(String prefix) {
        String lower = prefix.toLowerCase(Locale.ROOT);
        return BanRecord.snapshot().stream().map(BanRecord::username)
            .filter(name -> name.toLowerCase(Locale.ROOT).startsWith(lower)).toList();
    }

    @EventHandler public void onClick(InventoryClickEvent event) {
        InventoryHolder holder = event.getView().getTopInventory().getHolder(false);
        if (!(holder instanceof BanListMenu) && !(holder instanceof UnbanConfirmMenu)) return;
        event.setCancelled(true);
        if (!(event.getWhoClicked() instanceof Player player) || event.getClickedInventory() != event.getView().getTopInventory()) return;
        int slot = event.getRawSlot();
        if (holder instanceof BanListMenu menu) {
            switch (slot) {
                case BanListMenu.SLOT_PREVIOUS -> { if (menu.hasPrevious()) openLater(player, new BanListMenu(BanRecord.snapshot(), menu.page() - 1)); }
                case BanListMenu.SLOT_NEXT -> { if (menu.hasNext()) openLater(player, new BanListMenu(BanRecord.snapshot(), menu.page() + 1)); }
                case BanListMenu.SLOT_REFRESH -> openLater(player, new BanListMenu(BanRecord.snapshot(), menu.page()));
                case BanListMenu.SLOT_CLOSE -> player.closeInventory();
                default -> {
                    BanRecord ban = menu.banAt(slot);
                    if (ban != null) openLater(player, new UnbanConfirmMenu(ban, menu.page()));
                }
            }
        } else if (holder instanceof UnbanConfirmMenu menu) {
            switch (slot) {
                case UnbanConfirmMenu.SLOT_UNBAN -> { player.closeInventory(); unban(player, menu.ban().username(), false); }
                case UnbanConfirmMenu.SLOT_UNBAN_WHITELIST -> { player.closeInventory(); unban(player, menu.ban().username(), true); }
                case UnbanConfirmMenu.SLOT_BACK -> openLater(player, new BanListMenu(BanRecord.snapshot(), menu.returnPage()));
                default -> { }
            }
        }
    }

    @EventHandler public void onDrag(InventoryDragEvent event) {
        InventoryHolder holder = event.getView().getTopInventory().getHolder(false);
        if (holder instanceof BanListMenu || holder instanceof UnbanConfirmMenu) event.setCancelled(true);
    }

    private void openLater(Player player, InventoryHolder menu) {
        // Відкривати інше вікно всередині обробника кліку небезпечно — робимо це наступним тіком.
        Bukkit.getScheduler().runTask(plugin, () -> player.openInventory(menu.getInventory()));
    }

    /** Викликається з головного потоку. */
    private void unban(CommandSender sender, String username, boolean restoreWhitelist) {
        boolean wasBannedLocally = BanRecord.pardon(username);
        sender.sendMessage(Component.text(
            (wasBannedLocally ? "Бан " + username + " на сервері знято. " : "На сервері " + username + " не забанений. ")
                + "Оновлюємо сайт…", NamedTextColor.GRAY));
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                OkripApiClient.UnbanResult result = api.unban(username, restoreWhitelist, sender.getName());
                Bukkit.getScheduler().runTask(plugin, () -> report(sender, username, restoreWhitelist, result));
            } catch (Exception error) {
                if (error instanceof InterruptedException) Thread.currentThread().interrupt();
                plugin.getLogger().warning("/wlunban " + username + " failed: " + describe.apply(error));
                Bukkit.getScheduler().runTask(plugin, () -> sender.sendMessage(Component.text(
                    "Сайт не оновлено: " + describe.apply(error) + ". Повторіть /wlunban " + username
                        + (restoreWhitelist ? " wl" : ""), NamedTextColor.RED)));
            }
        });
    }

    private void report(CommandSender sender, String username, boolean restoreWhitelist, OkripApiClient.UnbanResult result) {
        plugin.getLogger().info("/wlunban by " + sender.getName() + ": username=" + result.username()
            + ", restoreWhitelist=" + restoreWhitelist + ", result=" + result.status() + ", access=" + result.access() + ".");
        switch (result.status()) {
            case "unbanned" -> sender.sendMessage(Component.text(restoreWhitelist
                ? result.username() + " розбанено й повернено у вайтліст. Сервер застосує це за кілька секунд."
                : result.username() + " розбанено. У вайтліст не повернено — додати можна в адмінці сайту.", NamedTextColor.GREEN));
            case "not_banned" -> sender.sendMessage(Component.text(result.username() + " не був забанений на сайті"
                + (result.access() == null ? "." : " (доступ: " + accessLabel(result.access()) + ").")
                + (restoreWhitelist && !"active".equals(result.access()) ? " Щоб повернути у вайтліст, додайте гравця в адмінці сайту." : ""),
                NamedTextColor.YELLOW));
            case "not_registered" -> sender.sendMessage(Component.text(username + " не зареєстрований на сайті"
                + (restoreWhitelist ? whitelistLocally(username) : "; знято лише бан сервера."), NamedTextColor.YELLOW));
            default -> sender.sendMessage(Component.text("Невідома відповідь API: " + result.status(), NamedTextColor.RED));
        }
    }

    private static String accessLabel(String access) {
        return switch (access) {
            case "active" -> "активний";
            case "revoked" -> "відкликаний";
            case "banned" -> "заблокований";
            default -> access;
        };
    }

    /** Гравця немає на сайті — додаємо лише в локальний вайтліст сервера. */
    private static String whitelistLocally(String username) {
        OfflinePlayer player = Bukkit.getOfflinePlayerIfCached(username);
        if (player == null && !Bukkit.getOnlineMode()) player = Bukkit.getOfflinePlayer(username);
        if (player == null) return "; у вайтліст не додано: сервер не знає цього гравця.";
        player.setWhitelisted(true);
        return "; бан знято й додано в локальний вайтліст сервера.";
    }
}
