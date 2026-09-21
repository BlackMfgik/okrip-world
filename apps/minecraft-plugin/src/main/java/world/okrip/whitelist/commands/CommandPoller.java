package world.okrip.whitelist.commands;
import com.google.gson.JsonObject;
import java.util.logging.Logger;
import world.okrip.whitelist.api.OkripApiClient;
public final class CommandPoller {
    private final OkripApiClient api;
    private final CommandExecutor executor;
    private final CommandAcknowledger acknowledger;
    private final Logger logger;
    public CommandPoller(OkripApiClient api, CommandExecutor executor, CommandAcknowledger acknowledger, Logger logger) {
        this.api = api; this.executor = executor; this.acknowledger = acknowledger; this.logger = logger;
    }
    public boolean tick() throws Exception {
        acknowledger.flush();
        JsonObject request = new JsonObject(); request.addProperty("limit", 1);
        long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(45);
        var response = api.post("/v1/minecraft/commands/lease", request);
        if (response.status() != 200) throw new IllegalStateException("Lease request failed: " + response.describe());
        if (!response.body().has("commands") || !response.body().get("commands").isJsonArray())
            throw new IllegalStateException("Lease response has no commands array");
        boolean processed = false;
        for (var value : response.body().getAsJsonArray("commands")) {
            processed = true;
            Command command = Command.parse(value.getAsJsonObject());
            logger.info("Command received: type=" + command.type() + ", username=" + command.username() + ", id=" + command.id() + ".");
            String failure;
            String executionDetail = null;
            try { failure = executor.execute(command, deadline); }
            catch (Exception error) { failure = "execution_failed"; executionDetail = detail(error); }
            if (failure == null)
                logger.info("Command result: type=" + command.type() + ", username=" + command.username() + ", result=success.");
            else
                logger.warning("Command result: type=" + command.type() + ", username=" + command.username()
                    + ", result=" + failure + (executionDetail == null ? "." : ", error=" + executionDetail + "."));
            acknowledger.record(command, failure);
            acknowledger.flush();
        }
        return processed;
    }
    private static String detail(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null) current = current.getCause();
        return current.getMessage() == null ? current.getClass().getSimpleName() : current.getMessage();
    }
}
