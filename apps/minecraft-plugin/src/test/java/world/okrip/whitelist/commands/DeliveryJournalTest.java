package world.okrip.whitelist.commands;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.io.IOException;
import java.nio.file.*;
import com.google.gson.JsonObject;
import static org.junit.jupiter.api.Assertions.*;
class DeliveryJournalTest {
    @TempDir Path directory;
    @Test void persistsAcknowledgementsAcrossRestart() throws Exception {
        Path path = directory.resolve("journal.json");
        DeliveryJournal journal = new DeliveryJournal(path);
        JsonObject body = new JsonObject(); body.addProperty("leaseToken", "lease");
        journal.put("id", "/v1/minecraft/commands/id/complete", body);
        DeliveryJournal restarted = new DeliveryJournal(path);
        assertEquals("lease", restarted.snapshot().get("id").getAsJsonObject("body").get("leaseToken").getAsString());
        restarted.remove("id"); assertTrue(new DeliveryJournal(path).snapshot().isEmpty());
    }
    @Test void refusesCorruptJournalInsteadOfLosingAcknowledgements() throws Exception {
        Path path = directory.resolve("journal.json"); Files.writeString(path, "{broken");
        IOException error = assertThrows(IOException.class, () -> new DeliveryJournal(path));
        assertTrue(error.getMessage().contains("invalid JSON"));
        assertTrue(error.getMessage().contains(path.toString()));
    }
}
