package world.okrip.whitelist.config;
import java.net.URI;
import org.bukkit.configuration.file.FileConfiguration;
public record PluginConfig(URI apiUrl, String serverId, String token, int timeout) {
    public static PluginConfig load(FileConfiguration config) {
        URI uri = URI.create(config.getString("api-url", ""));
        String token = config.getString("server-token", "");
        String server = config.getString("server-id", "");
        int timeout = config.getInt("timeout-seconds", 8);
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
            || token.length() < 32 || token.startsWith("REPLACE") || server.isBlank() || timeout < 1 || timeout > 15)
            throw new IllegalArgumentException("Invalid API configuration");
        return new PluginConfig(uri, server, token, timeout);
    }
}
