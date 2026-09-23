package world.okrip.whitelist.api;

import com.google.gson.JsonParser;
import java.io.IOException;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class WhitelistEntryTest {
    @Test void parsesPlayerDetails() throws IOException {
        var entries = WhitelistEntry.parse(JsonParser.parseString("""
            {"usernames":["Steve_UA"],"players":[{"username":"Steve_UA","discordId":"111","discordUsername":"steve",
             "discordDisplayName":null,"addedAt":"2026-09-23T18:40:00.000Z"}]}""").getAsJsonObject());
        assertEquals(1, entries.size());
        assertEquals("Steve_UA", entries.get(0).username());
        assertNull(entries.get(0).discordDisplayName());
        assertEquals(Instant.parse("2026-09-23T18:40:00Z"), entries.get(0).addedAt());
    }

    @Test void explainsOutdatedApi() {
        IOException error = assertThrows(IOException.class,
            () -> WhitelistEntry.parse(JsonParser.parseString("{\"usernames\":[]}").getAsJsonObject()));
        assertTrue(error.getMessage().contains("update the API"));
    }

    @Test void rejectsMalformedPlayers() {
        assertThrows(IOException.class, () -> WhitelistEntry.parse(JsonParser.parseString(
            "{\"players\":[{\"username\":\"bad name\",\"discordId\":\"1\",\"discordUsername\":\"x\",\"addedAt\":\"2026-01-01T00:00:00Z\"}]}")
            .getAsJsonObject()));
        assertThrows(IOException.class, () -> WhitelistEntry.parse(JsonParser.parseString(
            "{\"players\":[{\"username\":\"Steve\"}]}").getAsJsonObject()));
    }
}
