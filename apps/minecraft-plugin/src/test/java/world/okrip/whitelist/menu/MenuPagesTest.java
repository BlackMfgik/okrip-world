package world.okrip.whitelist.menu;

import java.time.Instant;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import world.okrip.whitelist.api.WhitelistEntry;
import static org.junit.jupiter.api.Assertions.*;

class MenuPagesTest {
    private static WhitelistEntry entry(String username, String discord, String displayName, String id) {
        return new WhitelistEntry(username, id, discord, displayName, Instant.EPOCH);
    }

    @Test void searchesByNicknameDiscordAndExactId() {
        List<WhitelistEntry> all = List.of(
            entry("Steve_UA", "steve", "Стів", "111"),
            entry("Alex", "alex_k", null, "222"));
        assertEquals(List.of(all.get(0)), MenuPages.filter(all, "steve_"));
        assertEquals(List.of(all.get(1)), MenuPages.filter(all, "ALEX_K"));
        assertEquals(List.of(all.get(0)), MenuPages.filter(all, "стів"));
        assertEquals(List.of(all.get(1)), MenuPages.filter(all, "222"));
        assertEquals(List.of(), MenuPages.filter(all, "22"));
        assertSame(all, MenuPages.filter(all, "  "));
    }

    @Test void splitsIntoPagesOfFortyFive() {
        List<Integer> items = IntStream.range(0, 100).boxed().toList();
        assertEquals(1, MenuPages.pageCount(0));
        assertEquals(1, MenuPages.pageCount(45));
        assertEquals(3, MenuPages.pageCount(100));
        assertEquals(45, MenuPages.page(items, 0).size());
        assertEquals(10, MenuPages.page(items, 2).size());
        assertEquals(90, MenuPages.page(items, 2).get(0));
        // Сторінка за межами після оновлення списку не падає, а показує останню.
        assertEquals(MenuPages.page(items, 2), MenuPages.page(items, 7));
        assertEquals(0, MenuPages.clampPage(-1, 100));
    }
}
