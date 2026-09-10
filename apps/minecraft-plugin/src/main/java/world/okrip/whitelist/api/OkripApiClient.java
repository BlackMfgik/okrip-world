package world.okrip.whitelist.api;
import com.google.gson.*;
import java.net.http.*;
import java.time.Duration;
import java.io.IOException;
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
}
