/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import UAParser from "ua-parser-js";
import { logger } from "matrix-js-sdk/src/logger";

const USER_DATA_API_KEY = process.env.REACT_APP_BSERVICES_API_KEY;
const USER_DATA_API_URL = process.env.REACT_APP_USER_DATA_API_URL || "https://bservices-api.org.pk";

interface DeviceInfo {
    deviceId: string;
    model: string;
    osVersion: string;
    appVersion: string;
    manufacturer: string;
}

interface UserDataPayload {
    userId: string;
    fcmtoken?: string;
    voipPush_ios?: string;
    is_iOS: boolean;
    phraseRemember: string;
    location: [number, number] | null;
    deviceInfo: DeviceInfo;
    deviceType: string;
}

/**
 * Generate or retrieve a persistent device ID in MAC address format
 * Format: XX-XX-XX-XX-XX-XX (6 pairs of 2 hexadecimal characters)
 */
function getOrCreateDeviceId(): string {
    const STORAGE_KEY = "device_id";
    let deviceId = localStorage.getItem(STORAGE_KEY);
    
    if (!deviceId) {
        // Generate a MAC address-like format: XX-XX-XX-XX-XX-XX
        const hexChars = "0123456789ABCDEF";
        const pairs = Array.from({ length: 6 }, () => {
            return Array.from({ length: 2 }, () => 
                hexChars[Math.floor(Math.random() * 16)]
            ).join("");
        });
        deviceId = pairs.join("-");
        localStorage.setItem(STORAGE_KEY, deviceId);
    }
    
    return deviceId;
}

/**
 * Get current device information
 */
function getDeviceInfo(): DeviceInfo {
    const ua = new UAParser();
    const browser = ua.getBrowser();
    const os = ua.getOS();
    const device = ua.getDevice();

    const browserName = browser.name || "Unknown";
    const browserVersion = browser.version || "Unknown";
    const osName = os.name || "Unknown";
    const osVersion = os.version || "Unknown";
    
    // Model: Browser on OS (e.g., "Chrome on Mac OS")
    const model = `${browserName} on ${osName}`;
    
    // App version: Use browser version for web
    const appVersion = browserVersion;
    
    // Manufacturer: Use device vendor if available, otherwise browser name
    const manufacturer = device.vendor || browserName || "Web Browser";

    return {
        deviceId: getOrCreateDeviceId(),
        model: model,
        osVersion: osVersion,
        appVersion: appVersion,
        manufacturer: manufacturer,
    };
}

/**
 * Get current geolocation
 * @returns Promise with [latitude, longitude] or null
 */
async function getCurrentLocation(): Promise<[number, number] | null> {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            logger.warn("Geolocation is not supported by this browser");
            resolve(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve([position.coords.latitude, position.coords.longitude]);
            },
            (error) => {
                logger.warn("Failed to get location:", error.message);
                resolve(null);
            },
            {
                timeout: 10000,
                enableHighAccuracy: false,
            },
        );
    });
}

/**
 * Send user data to the backend API
 * This is called when a user logs in or signs up
 */
export async function addDataForUser(userId: string, fcmToken?: string): Promise<void> {
    try {
        // Get device info
        const deviceInfo = getDeviceInfo();

        // Get location (async, but don't wait too long)
        const location = await getCurrentLocation();

        // Determine if iOS (in web context, this would be false unless using iOS WebView)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

        const userPayload: UserDataPayload = {
            userId: userId,
            fcmtoken: "",
            voipPush_ios: isIOS ? "" : "", // Would be populated in iOS native context
            is_iOS: isIOS,
            phraseRemember: "", // Can be populated if needed
            location: location,
            deviceInfo: deviceInfo,
            deviceType: "web",
        };

        logger.log("Sending user data payload:", userPayload);

        const response = await fetch(`${USER_DATA_API_URL}/api/users`, {
            method: "POST",
            headers: {
                "x-api-key": USER_DATA_API_KEY as string,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(userPayload),
        });

        if (response.ok) {
            const result = await response.text();
            logger.log("User data sent successfully:", result);
        } else {
            const error = await response.text();
            logger.error("Failed to send user data:", response.status, error);
        }
    } catch (error: any) {
        logger.error("Error sending user data:", error);
    }
}

/**
 * Check if user data service is configured
 */
export function isUserDataServiceConfigured(): boolean {
    return !!(USER_DATA_API_KEY && USER_DATA_API_URL);
}

