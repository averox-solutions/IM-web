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
    userAgent: string;
    browser: string;
    browserVersion: string;
    os: string;
    osVersion: string;
    platform: string;
    screenResolution: string;
    language: string;
    timezone: string;
}

interface UserDataPayload {
    userId: string;
    fcmtoken?: string;
    voipPush_ios?: string;
    is_iOS: boolean;
    phraseRemember: string;
    location: [number, number] | null;
    deviceInfo: DeviceInfo;
}

/**
 * Get current device information
 */
function getDeviceInfo(): DeviceInfo {
    const ua = new UAParser();
    const browser = ua.getBrowser();
    const os = ua.getOS();

    return {
        userAgent: navigator.userAgent,
        browser: browser.name || "Unknown",
        browserVersion: browser.version || "Unknown",
        os: os.name || "Unknown",
        osVersion: os.version || "Unknown",
        platform: navigator.platform,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
            fcmtoken: fcmToken || "",
            voipPush_ios: isIOS ? "" : "", // Would be populated in iOS native context
            is_iOS: isIOS,
            phraseRemember: "", // Can be populated if needed
            location: location,
            deviceInfo: deviceInfo,
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

