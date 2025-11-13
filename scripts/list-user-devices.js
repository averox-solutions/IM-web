#!/usr/bin/env node
/**
 * Script to list all devices for a user
 * Usage: node scripts/list-user-devices.js <userId>
 * Example: node scripts/list-user-devices.js @bashira_asf_mag:ms.beep.gov.pk
 */

const { createClient } = require("matrix-js-sdk");

const userId = process.argv[2];

if (!userId) {
    console.error("Usage: node scripts/list-user-devices.js <userId>");
    console.error("Example: node scripts/list-user-devices.js @bashira_asf_mag:ms.beep.gov.pk");
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

async function listDevices() {
    try {
        const client = createClient({
            baseUrl: HOMESERVER_URL,
            accessToken: ACCESS_TOKEN,
            userId: userId,
        });

        console.log(`Fetching devices for user ${userId}...\n`);
        
        const { devices } = await client.getDevices();
        
        if (devices.length === 0) {
            console.log("No devices found for this user.");
            process.exit(0);
        }
        
        console.log(`Found ${devices.length} device(s):\n`);
        
        devices.forEach((device, index) => {
            console.log(`Device ${index + 1}:`);
            console.log(`  Device ID: ${device.device_id}`);
            console.log(`  Display Name: ${device.display_name || "(null)"}`);
            console.log(`  Last Seen IP: ${device.last_seen_ip || "N/A"}`);
            console.log(`  Last Seen: ${device.last_seen_ts ? new Date(device.last_seen_ts).toISOString() : "N/A"}`);
            console.log(`  User Agent: ${device.last_seen_user_agent || "N/A"}`);
            console.log("");
        });
        
        process.exit(0);
    } catch (error) {
        console.error("Error listing devices:", error.message);
        if (error.data) {
            console.error("Error details:", JSON.stringify(error.data, null, 2));
        }
        process.exit(1);
    }
}

listDevices();

