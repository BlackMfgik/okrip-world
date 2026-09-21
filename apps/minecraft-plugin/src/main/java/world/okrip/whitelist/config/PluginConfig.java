package world.okrip.whitelist.config;
import java.net.URI;
import java.util.Locale;
import org.bukkit.configuration.file.FileConfiguration;
public record PluginConfig(URI apiUrl, String serverId, String token, int timeout) {
    public static PluginConfig load(FileConfiguration config) {
        String apiUrl = config.getString("api-url");
        String serverId = config.getString("server-id");
        String token = config.getString("server-token");
        if (!config.isInt("timeout-seconds")) {
            throw invalid("timeout-seconds", "must be an integer from 1 to 15");
        }
        return validate(apiUrl, serverId, token, config.getInt("timeout-seconds"));
    }

    public static PluginConfig validate(String apiUrl, String serverId, String token, int timeout) {
        if (apiUrl == null || apiUrl.isBlank()) {
            throw invalid("api-url", "is required");
        }

        URI uri;
        try {
            uri = URI.create(apiUrl.trim());
        } catch (IllegalArgumentException error) {
            throw invalid("api-url", "is not a valid URL: " + detail(error));
        }
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw invalid("api-url", "must use https");
        }
        if (uri.getHost() == null) {
            throw invalid("api-url", "must contain a host name");
        }
        if (uri.getUserInfo() != null) {
            throw invalid("api-url", "must not contain user information");
        }
        if (uri.getQuery() != null) {
            throw invalid("api-url", "must not contain a query string");
        }
        if (uri.getFragment() != null) {
            throw invalid("api-url", "must not contain a fragment");
        }
        if (serverId == null || serverId.isBlank()) {
            throw invalid("server-id", "is required and must match MINECRAFT_SERVER_ID in Railway");
        }
        if (token == null || token.isBlank()) {
            throw invalid("server-token", "is required");
        }
        if (token.toUpperCase(Locale.ROOT).startsWith("REPLACE")) {
            throw invalid("server-token", "still contains the default placeholder; copy MINECRAFT_SERVER_TOKEN from Railway");
        }
        if (token.length() < 32) {
            throw invalid("server-token", "must contain at least 32 characters");
        }
        if (timeout < 1 || timeout > 15) {
            throw invalid("timeout-seconds", "must be from 1 to 15");
        }
        return new PluginConfig(uri, serverId.trim(), token, timeout);
    }

    private static IllegalArgumentException invalid(String field, String reason) {
        return new IllegalArgumentException(field + ": " + reason);
    }

    private static String detail(Exception error) {
        return error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
    }
}
