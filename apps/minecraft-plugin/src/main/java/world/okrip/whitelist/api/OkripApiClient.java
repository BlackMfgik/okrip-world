package world.okrip.whitelist.api;
import com.google.gson.*;
import java.net.http.*;
import java.net.URI;
import java.time.Duration;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import world.okrip.whitelist.config.PluginConfig;
public final class OkripApiClient {
    private final PluginConfig config;
    private final HttpClient client;
    public OkripApiClient(PluginConfig config) {
        this.config = config;
        client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(config.timeout())).followRedirects(HttpClient.Redirect.NEVER).build();
    }
    public record Result(int status, JsonObject body) {
        public String describe() {
            String code = body.has("code") && body.get("code").isJsonPrimitive() ? body.get("code").getAsString() : null;
            String message = body.has("message") && body.get("message").isJsonPrimitive() ? body.get("message").getAsString() : null;
            String suffix = code == null ? "" : " " + code;
            if (message != null && !message.isBlank()) suffix += ": " + message;
            return "HTTP " + status + suffix;
        }
    }
    public Result post(String path, JsonObject body) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(config.apiUrl().resolve(path))
            .timeout(Duration.ofSeconds(config.timeout())).header("Authorization", "Bearer " + config.token())
            .header("X-Server-Id", config.serverId()).header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body.toString())).build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        JsonObject json;
        try {
            json = response.body().isBlank() ? new JsonObject() : JsonParser.parseString(response.body()).getAsJsonObject();
        } catch (JsonParseException | IllegalStateException error) {
            String text = response.body().replaceAll("[\\r\\n]+", " ").trim();
            if (text.length() > 200) text = text.substring(0, 200) + "...";
            throw new IOException("POST " + path + " returned invalid JSON (HTTP " + response.statusCode() + "): " + text, error);
        }
        return new Result(response.statusCode(), json);
    }
    public List<WhitelistEntry> whitelistPlayers() throws IOException, InterruptedException {
        return WhitelistEntry.parse(snapshot());
    }
    private JsonObject snapshot() throws IOException, InterruptedException {
        Result response = post("/v1/minecraft/whitelist/snapshot", new JsonObject());
        if (response.status() != 200 || !response.body().has("usernames"))
            throw new IOException("Whitelist snapshot request failed: " + response.describe());
        return response.body();
    }
    /** Результат /wldel: removed, not_active (доступ уже скасовано) або not_registered (ніка немає на сайті). */
    public record RemoveResult(String status, String username) {}
    public RemoveResult removeFromWhitelist(String username, String actor) throws IOException, InterruptedException {
        JsonObject body = new JsonObject(); body.addProperty("username", username); body.addProperty("actor", actor);
        Result response = post("/v1/minecraft/whitelist/remove", body);
        if (response.status() == 404)
            throw new IOException("API does not support whitelist removal yet; update the API service");
        if (response.status() != 200 || !response.body().has("status"))
            throw new IOException("Whitelist removal failed: " + response.describe());
        JsonElement registered = response.body().get("username");
        return new RemoveResult(response.body().get("status").getAsString(),
            registered == null || registered.isJsonNull() ? username : registered.getAsString());
    }
    public List<String> activeWhitelist() throws IOException, InterruptedException {
        JsonObject snapshot = snapshot();
        List<String> usernames = new ArrayList<>();
        for (JsonElement value : snapshot.getAsJsonArray("usernames")) {
            String username = value.getAsString();
            if (!username.matches("[A-Za-z0-9_]{3,16}"))
                throw new IOException("Invalid username in whitelist snapshot");
            usernames.add(username);
        }
        return usernames;
    }
    public CompletableFuture<WebSocket> watch(WebSocket.Listener listener) {
        URI httpUri = config.apiUrl().resolve("/v1/minecraft/commands/watch");
        URI websocketUri = URI.create("wss" + httpUri.toString().substring("https".length()));
        return client.newWebSocketBuilder()
            .connectTimeout(Duration.ofSeconds(config.timeout()))
            .header("Authorization", "Bearer " + config.token())
            .header("X-Server-Id", config.serverId())
            .buildAsync(websocketUri, listener);
    }
}
