package world.okrip.whitelist.commands;
import com.google.gson.JsonObject;
import java.util.UUID;
public record Command(String id, String leaseToken, String type, String username, String reason) {
    public static Command parse(JsonObject value) {
        String id = value.get("id").getAsString(), token = value.get("leaseToken").getAsString();
        UUID.fromString(id); UUID.fromString(token);
        JsonObject payload = value.getAsJsonObject("payload");
        String username = payload.get("username").getAsString();
        String type = value.get("type").getAsString();
        if (!username.matches("[A-Za-z0-9_]{3,16}") || !java.util.Set.of("whitelist_add", "whitelist_remove", "kick", "ban").contains(type))
            throw new IllegalArgumentException("Invalid command");
        return new Command(id, token, type, username, payload.has("reason") ? payload.get("reason").getAsString() : "Okrip World moderation");
    }
}
