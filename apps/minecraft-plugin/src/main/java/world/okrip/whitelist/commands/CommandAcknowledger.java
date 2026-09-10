package world.okrip.whitelist.commands;
import com.google.gson.JsonObject;
import world.okrip.whitelist.api.OkripApiClient;
public final class CommandAcknowledger {
    private final DeliveryJournal journal;
    private final OkripApiClient api;
    public CommandAcknowledger(DeliveryJournal journal, OkripApiClient api) { this.journal = journal; this.api = api; }
    public void record(Command command, String failure) throws Exception {
        if ("local_ban".equals(failure)) {
            String eventId = java.util.UUID.randomUUID().toString();
            JsonObject ban = new JsonObject(); ban.addProperty("eventId", eventId); ban.addProperty("username", command.username()); ban.addProperty("reason", "Existing Minecraft ban");
            journal.put("ban:" + eventId, "/v1/minecraft/events/ban", ban);
        }
        JsonObject body = new JsonObject(); body.addProperty("leaseToken", command.leaseToken());
        if (failure != null) body.addProperty("error", failure);
        journal.put(command.id(), "/v1/minecraft/commands/" + command.id() + (failure == null ? "/complete" : "/fail"), body);
    }
    public boolean flush() throws Exception {
        for (var entry : journal.snapshot().entrySet()) {
            String endpoint = entry.getValue().get("endpoint").getAsString();
            var response = api.post(endpoint, entry.getValue().getAsJsonObject("body"));
            if (response.status() >= 200 && response.status() < 300 || response.status() == 409 && endpoint.contains("/commands/")
                || response.status() == 404 && endpoint.endsWith("/events/ban")) journal.remove(entry.getKey());
            else return false;
        }
        return true;
    }
}
