package world.okrip.whitelist.commands;

/** Правило ванільного enforce-whitelist без залежності від Bukkit, щоб його можна було перевірити тестом. */
final class WhitelistEnforcement {
    private WhitelistEnforcement() {}

    static boolean shouldKick(boolean whitelistOn, boolean enforced, boolean whitelisted, boolean op) {
        return whitelistOn && enforced && !whitelisted && !op;
    }
}
