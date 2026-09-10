package world.okrip.whitelist.commands;
import com.google.gson.JsonObject;
import world.okrip.whitelist.api.OkripApiClient;
public final class CommandPoller {
    private final OkripApiClient api;
    private final CommandExecutor executor;
    private final CommandAcknowledger acknowledger;
    public CommandPoller(OkripApiClient api, CommandExecutor executor, CommandAcknowledger acknowledger) { this.api = api; this.executor = executor; this.acknowledger = acknowledger; }
    public void tick() throws Exception {
        if (!acknowledger.flush()) return;
        JsonObject request = new JsonObject(); request.addProperty("limit", 1);
        long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(45);
        var response = api.post("/v1/minecraft/commands/lease", request);
        if (response.status() != 200) throw new IllegalStateException("Lease request failed");
        for (var value : response.body().getAsJsonArray("commands")) {
            Command command = Command.parse(value.getAsJsonObject());
            String failure;
            try { failure = executor.execute(command, deadline); } catch (Exception error) { failure = "execution_failed"; }
            acknowledger.record(command, failure);
            if (!acknowledger.flush()) return;
        }
    }
}
