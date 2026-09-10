package world.okrip.whitelist.commands;
import com.google.gson.*;
import java.nio.file.*;
import java.nio.channels.FileChannel;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.util.*;
public final class DeliveryJournal {
    private final Path path;
    private final LinkedHashMap<String, JsonObject> entries = new LinkedHashMap<>();
    public DeliveryJournal(Path path) throws IOException {
        this.path = path;
        if (Files.exists(path)) {
            JsonObject saved = JsonParser.parseString(Files.readString(path)).getAsJsonObject();
            saved.entrySet().forEach(entry -> entries.put(entry.getKey(), entry.getValue().getAsJsonObject()));
        }
    }
    public synchronized void put(String key, String endpoint, JsonObject body) throws IOException {
        JsonObject value = new JsonObject(); value.addProperty("endpoint", endpoint); value.add("body", body);
        entries.put(key, value); save();
    }
    public synchronized void remove(String key) throws IOException { entries.remove(key); save(); }
    public synchronized Map<String, JsonObject> snapshot() { return new LinkedHashMap<>(entries); }
    private void save() throws IOException {
        Files.createDirectories(path.getParent()); Path temp = path.resolveSibling(path.getFileName() + ".tmp");
        byte[] bytes = new Gson().toJson(entries).getBytes(StandardCharsets.UTF_8);
        try (FileChannel channel = FileChannel.open(temp, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE)) {
            ByteBuffer buffer = ByteBuffer.wrap(bytes); while (buffer.hasRemaining()) channel.write(buffer); channel.force(true);
        }
        Files.move(temp, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }
}
