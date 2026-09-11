package world.okrip.whitelist.api;
import com.google.gson.*;
import java.net.http.*;
import java.net.URI;
import java.time.Duration;
import java.io.IOException;
import java.util.concurrent.CompletableFuture;
import world.okrip.whitelist.config.PluginConfig;
public final class OkripApiClient {
    private final PluginConfig config;
    private final HttpClient client;
    public OkripApiClient(PluginConfig config) {
        this.config = config;
        client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(config.timeout())).followRedirects(HttpClient.Redirect.NEVER).build();
    }
    public record Result(int status, JsonObject body) {}
    public Result post(String path, JsonObject body) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(config.apiUrl().resolve(path))
            .timeout(Duration.ofSeconds(config.timeout())).header("Authorization", "Bearer " + config.token())
            .header("X-Server-Id", config.serverId()).header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body.toString())).build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        JsonObject json = response.body().isBlank() ? new JsonObject() : JsonParser.parseString(response.body()).getAsJsonObject();
        return new Result(response.statusCode(), json);
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
