package world.okrip.whitelist.commands;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.CommandSender;
import org.bukkit.plugin.java.JavaPlugin;
import world.okrip.whitelist.api.OkripApiClient;
import java.util.function.Function;
/**
 * /wldel &lt;нік&gt; — прибирає гравця з вайтліста через API, як кнопка «Видалити» в адмін-панелі сайту.
 * Лише локальне видалення не спрацювало б: звірка кожні 5 хвилин повернула б гравця з сайту.
 */
public final class WhitelistRemoveCommand {
    private final JavaPlugin plugin;
    private final OkripApiClient api;
    private final Function<Throwable, String> describe;

    public WhitelistRemoveCommand(JavaPlugin plugin, OkripApiClient api, Function<Throwable, String> describe) {
        this.plugin = plugin;
        this.api = api;
        this.describe = describe;
    }

    public boolean onCommand(CommandSender sender, String[] args) {
        if (args.length != 1 || !args[0].matches("[A-Za-z0-9_]{3,16}")) return false;
        String username = args[0];
        sender.sendMessage(Component.text("Видаляємо " + username + " з вайтліста…", NamedTextColor.GRAY));
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                OkripApiClient.RemoveResult result = api.removeFromWhitelist(username, sender.getName());
                Bukkit.getScheduler().runTask(plugin, () -> report(sender, result));
            } catch (Exception error) {
                if (error instanceof InterruptedException) Thread.currentThread().interrupt();
                plugin.getLogger().warning("/wldel " + username + " failed: " + describe.apply(error));
                Bukkit.getScheduler().runTask(plugin, () -> sender.sendMessage(Component.text(
                    "Не вдалося видалити " + username + ": " + describe.apply(error), NamedTextColor.RED)));
            }
        });
        return true;
    }

    private void report(CommandSender sender, OkripApiClient.RemoveResult result) {
        plugin.getLogger().info("/wldel by " + sender.getName() + ": username=" + result.username() + ", result=" + result.status() + ".");
        switch (result.status()) {
            // Сам запис у whitelist.json прибере команда whitelist_remove, яку плагін отримає від API за кілька секунд.
            case "removed" -> sender.sendMessage(Component.text(
                result.username() + " видалено з вайтліста. Доступ на сайті скасовано.", NamedTextColor.GREEN));
            case "not_active" -> sender.sendMessage(Component.text(
                result.username() + " уже не мав активного доступу на сайті" + removeLocally(result.username()), NamedTextColor.YELLOW));
            case "not_registered" -> sender.sendMessage(Component.text(
                result.username() + " не зареєстрований на сайті" + removeLocally(result.username()), NamedTextColor.YELLOW));
            default -> sender.sendMessage(Component.text("Невідома відповідь API: " + result.status(), NamedTextColor.RED));
        }
    }

    /** Якщо нік є лише в локальному whitelist.json (доданий вручну), прибираємо його тут. */
    private static String removeLocally(String username) {
        // Шукаємо серед уже доданих, а не через getOfflinePlayer(name): в online-mode той робить запит до Mojang у головному потоці.
        for (OfflinePlayer player : Bukkit.getWhitelistedPlayers()) {
            if (username.equalsIgnoreCase(player.getName())) {
                player.setWhitelisted(false);
                return "; прибрано з локального вайтліста сервера.";
            }
        }
        return ", і в локальному вайтлісті його немає.";
    }
}
