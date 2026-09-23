package world.okrip.whitelist.api;
import com.google.gson.*;
import java.io.IOException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
/** Гравець з активним доступом: нік, Discord-акаунт і час додавання до вайтліста. */
public record WhitelistEntry(String username, String discordId, String discordUsername, String discordDisplayName, Instant addedAt) {
    /** Розбирає поле players з /v1/minecraft/whitelist/snapshot. */
    public static List<WhitelistEntry> parse(JsonObject snapshot) throws IOException {
        if (!snapshot.has("players") || !snapshot.get("players").isJsonArray())
            throw new IOException("API does not return player details; update the API service");
        List<WhitelistEntry> entries = new ArrayList<>();
        for (JsonElement value : snapshot.getAsJsonArray("players")) {
            try {
                JsonObject player = value.getAsJsonObject();
                String username = player.get("username").getAsString();
                if (!username.matches("[A-Za-z0-9_]{3,16}")) throw new IOException("Invalid username in whitelist snapshot");
                JsonElement displayName = player.get("discordDisplayName");
                entries.add(new WhitelistEntry(
                    username,
                    player.get("discordId").getAsString(),
                    player.get("discordUsername").getAsString(),
                    displayName == null || displayName.isJsonNull() ? null : displayName.getAsString(),
                    Instant.parse(player.get("addedAt").getAsString())));
            } catch (IllegalStateException | UnsupportedOperationException | NullPointerException | DateTimeParseException error) {
                throw new IOException("Invalid player in whitelist snapshot", error);
            }
        }
        return entries;
    }
}
