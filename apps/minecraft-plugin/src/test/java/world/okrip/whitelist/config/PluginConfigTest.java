package world.okrip.whitelist.config;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PluginConfigTest {
    private static final String TOKEN = "0123456789abcdef0123456789abcdef";

    @Test void acceptsProductionConfiguration() {
        PluginConfig config = PluginConfig.validate("https://api.example.com", "vanilla", TOKEN, 8);
        assertEquals("vanilla", config.serverId());
    }

    @Test void namesEveryInvalidField() {
        assertField("api-url", () -> PluginConfig.validate("http://api.example.com", "vanilla", TOKEN, 8));
        assertField("server-id", () -> PluginConfig.validate("https://api.example.com", " ", TOKEN, 8));
        assertField("server-token", () -> PluginConfig.validate("https://api.example.com", "vanilla", "REPLACE_ME", 8));
        assertField("timeout-seconds", () -> PluginConfig.validate("https://api.example.com", "vanilla", TOKEN, 16));
    }

    @Test void rejectsUrlPartsThatCouldChangeTheApiDestination() {
        assertField("api-url", () -> PluginConfig.validate("https://user@api.example.com", "vanilla", TOKEN, 8));
        assertField("api-url", () -> PluginConfig.validate("https://api.example.com?x=1", "vanilla", TOKEN, 8));
        assertField("api-url", () -> PluginConfig.validate("https://api.example.com#x", "vanilla", TOKEN, 8));
    }

    private static void assertField(String field, Executable executable) {
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, executable::run);
        assertTrue(error.getMessage().startsWith(field + ":"), error.getMessage());
    }

    @FunctionalInterface
    private interface Executable { void run(); }
}
