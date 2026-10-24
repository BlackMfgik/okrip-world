package world.okrip.whitelist.commands;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class WhitelistKickTest {
    @Test
    void kicksRemovedPlayerWhenWhitelistIsEnforced() {
        assertTrue(WhitelistEnforcement.shouldKick(true, true, false, false));
    }

    @Test
    void keepsPlayerWhenWhitelistIsOffOrNotEnforced() {
        assertFalse(WhitelistEnforcement.shouldKick(false, true, false, false));
        assertFalse(WhitelistEnforcement.shouldKick(true, false, false, false));
    }

    @Test
    void keepsOperatorsAndStillWhitelistedPlayers() {
        assertFalse(WhitelistEnforcement.shouldKick(true, true, false, true));
        assertFalse(WhitelistEnforcement.shouldKick(true, true, true, false));
    }
}
