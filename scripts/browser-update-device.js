/**
 * Browser Console Script to Update Device Display Name
 * 
 * Run this in the browser console when logged in to update a device's display name.
 * 
 * Usage in browser console:
 *   updateDeviceName("DEVICE_ID", "Chrome on Windows")
 * 
 * To list all devices first:
 *   listMyDevices()
 */

async function listMyDevices() {
    const client = window.mxMatrixClientPeg?.get();
    if (!client) {
        console.error("Matrix client not found. Make sure you're logged in.");
        return;
    }
    
    try {
        const { devices } = await client.getDevices();
        console.log(`Found ${devices.length} device(s):\n`);
        devices.forEach((device, index) => {
            console.log(`${index + 1}. Device ID: ${device.device_id}`);
            console.log(`   Display Name: ${device.display_name || "(null)"}`);
            console.log(`   Last Seen: ${device.last_seen_ts ? new Date(device.last_seen_ts).toISOString() : "N/A"}`);
            console.log("");
        });
        return devices;
    } catch (error) {
        console.error("Error listing devices:", error);
    }
}

async function updateDeviceName(deviceId, deviceName) {
    const client = window.mxMatrixClientPeg?.get();
    if (!client) {
        console.error("Matrix client not found. Make sure you're logged in.");
        return;
    }
    
    if (!deviceId || !deviceName) {
        console.error("Usage: updateDeviceName(deviceId, deviceName)");
        console.error("Example: updateDeviceName('ABC123', 'Chrome on Windows')");
        return;
    }
    
    try {
        console.log(`Updating device ${deviceId} display name to "${deviceName}"...`);
        await client.setDeviceDetails(deviceId, { display_name: deviceName });
        console.log("✓ Device display name updated successfully!");
        
        // Refresh and show updated device
        const { devices } = await client.getDevices();
        const device = devices.find(d => d.device_id === deviceId);
        if (device) {
            console.log(`\nUpdated device:`);
            console.log(`  Device ID: ${device.device_id}`);
            console.log(`  Display Name: ${device.display_name}`);
        }
    } catch (error) {
        console.error("Error updating device name:", error);
    }
}

// Auto-generate device name for current device
async function updateCurrentDeviceName() {
    const client = window.mxMatrixClientPeg?.get();
    if (!client) {
        console.error("Matrix client not found. Make sure you're logged in.");
        return;
    }
    
    const deviceId = client.getDeviceId();
    if (!deviceId) {
        console.error("Could not get current device ID");
        return;
    }
    
    // Generate device name using UAParser
    const ua = new UAParser();
    const browserName = ua.getBrowser().name || "Unknown Browser";
    let osName = ua.getOS().name || "Unknown OS";
    if (osName === "Mac OS") osName = "macOS";
    const deviceName = `${browserName} on ${osName}`;
    
    console.log(`Auto-generating device name for current device: ${deviceName}`);
    await updateDeviceName(deviceId, deviceName);
}

// Export functions to global scope
if (typeof window !== 'undefined') {
    window.listMyDevices = listMyDevices;
    window.updateDeviceName = updateDeviceName;
    window.updateCurrentDeviceName = updateCurrentDeviceName;
    console.log("Device management functions loaded:");
    console.log("  - listMyDevices() - List all your devices");
    console.log("  - updateDeviceName(deviceId, name) - Update a device's display name");
    console.log("  - updateCurrentDeviceName() - Auto-update current device name");
}

