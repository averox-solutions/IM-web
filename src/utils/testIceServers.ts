/*
 * Test utility for injecting custom ICE servers
 * Usage: Call testIceServers() in browser console or during development
 * 
 * Example:
 * testIceServers([
 *   {
 *     urls: ["turns:turn-130.averox.com:3478?transport=udp", "turns:turn-130.averox.com:3478?transport=tcp"],
 *     username: "1767360372:@super_admin:ms.beep.gov.pk",
 *     credential: "XKLvRYyxtl09qjvAepmP+FkRmR8="
 *   }
 * ]);
 */

import MatrixClientPeg from "../MatrixClientPeg";

interface TestIceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
}

/**
 * Test custom ICE servers configuration
 * @param iceServers Array of ICE server configurations in RTCIceServer format
 */
export function testIceServers(iceServers: TestIceServer[]): void {
    const client = MatrixClientPeg.get();
    if (!client) {
        console.error("❌ MatrixClient not initialized. Please login first.");
        return;
    }

    // Convert RTCIceServer format to Matrix IClientTurnServer format
    const matrixTurnServers = iceServers.map((server) => ({
        urls: Array.isArray(server.urls) ? server.urls : [server.urls],
        username: server.username || "",
        credential: server.credential || "",
    }));

    // Store original method
    const originalGetTurnServers = client.getTurnServers.bind(client);
    
    // Override getTurnServers method
    (client as any).getTurnServers = function() {
        console.log("🧪 Using test ICE servers:", matrixTurnServers);
        return matrixTurnServers;
    };

    // Also override pollingTurnServers to ensure servers are used
    (client as any).pollingTurnServers = true;

    console.log("✅ Test ICE servers injected successfully!");
    console.log("📋 Servers:", matrixTurnServers);
    console.log("📝 To restore original servers, reload the page or call restoreIceServers()");
    
    // Store original for restoration
    (client as any)._originalGetTurnServers = originalGetTurnServers;
}

/**
 * Restore original TURN servers
 */
export function restoreIceServers(): void {
    const client = MatrixClientPeg.get();
    if (!client) {
        console.error("❌ MatrixClient not initialized");
        return;
    }

    if ((client as any)._originalGetTurnServers) {
        (client as any).getTurnServers = (client as any)._originalGetTurnServers;
        delete (client as any)._originalGetTurnServers;
        console.log("✅ Original ICE servers restored");
    } else {
        console.log("ℹ️ No test servers to restore. Reload page to reset.");
    }
}

/**
 * Check current ICE servers being used
 */
export function checkIceServers(): void {
    const client = MatrixClientPeg.get();
    if (!client) {
        console.error("❌ MatrixClient not initialized");
        return;
    }

    const servers = client.getTurnServers();
    console.log("📋 Current ICE servers:", servers);
    console.log("🔄 Polling enabled:", client.pollingTurnServers);
}

// Make it available globally for console testing
if (typeof window !== "undefined") {
    (window as any).testIceServers = testIceServers;
    (window as any).restoreIceServers = restoreIceServers;
    (window as any).checkIceServers = checkIceServers;
    
    console.log("🧪 ICE Server testing utilities loaded!");
    console.log("   - testIceServers(servers) - Inject test ICE servers");
    console.log("   - restoreIceServers() - Restore original servers");
    console.log("   - checkIceServers() - Check current servers");
}

