#!/usr/bin/env node
/**
 * Script to update device display name for a user
 * Usage: node scripts/update-device-name.js <userId> <deviceId> <deviceName>
 * Example: node scripts/update-device-name.js @bashira_asf_mag:ms.beep.gov.pk ABC123 "Chrome on Windows"
 */

const { createClient } = require("matrix-js-sdk");

const userId = process.argv[2];
const deviceId = process.argv[3];
const deviceName = process.argv[4];

if (!userId || !deviceId || !deviceName) {
    console.error("Usage: node scripts/update-device-name.js <userId> <deviceId> <deviceName>");
    console.error("Example: node scripts/update-device-name.js @bashira_asf_mag:ms.beep.gov.pk ABC123 \"Chrome on Windows\"");
    process.exit(1);
}

// You'll need to set these environment variables or modify this script
const HOMESERVER_URL = process.env.MATRIX_HOMESERVER_URL || "https://ms.beep.gov.pk";
const ACCESS_TOKEN = process.env.MATRIX_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
    console.error("Error: MATRIX_ACCESS_TOKEN environment variable is required");
    console.error("Set it with: export MATRIX_ACCESS_TOKEN=your_token_here");
    process.exit(1);
}

async function updateDeviceName() {
    try {
        const client = createClient({
            baseUrl: HOMESERVER_URL,
            accessToken: ACCESS_TOKEN,
            userId: userId,
        });

        console.log(`Updating device ${deviceId} display name to "${deviceName}" for user ${userId}...`);
        
        await client.setDeviceDetails(deviceId, { display_name: deviceName });
        
        console.log("✓ Device display name updated successfully!");
        
        // Verify by fetching devices
        const { devices } = await client.getDevices();
        const device = devices.find(d => d.device_id === deviceId);
        
        if (device) {
            console.log(`\nDevice details:`);
            console.log(`  Device ID: ${device.device_id}`);
            console.log(`  Display Name: ${device.display_name || "(null)"}`);
            console.log(`  Last Seen IP: ${device.last_seen_ip || "N/A"}`);
            console.log(`  Last Seen: ${device.last_seen_ts ? new Date(device.last_seen_ts).toISOString() : "N/A"}`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error("Error updating device name:", error.message);
        if (error.data) {
            console.error("Error details:", JSON.stringify(error.data, null, 2));
        }
        process.exit(1);
    }
}

updateDeviceName();

