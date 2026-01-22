/*
Copyright 2024 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

export interface Ministry {
    id: number;
    name: string;
    code: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
    userCount: number;
}

export interface Designation {
    id: number;
    name: string;
    code: string;
    ministryId: number;
    description: string | null;
    createdAt: string;
    updatedAt: string;
}

// Get base URL from environment variable, fallback to default
// In development, use proxy path to avoid CORS issues
// In production, use full URL
const isDevelopment = process.env.NODE_ENV === "development" || process.env.REACT_APP_ENV === "dev";
const ADMIN_API_BASE_URL = isDevelopment 
    ? "" // Use relative path in development (goes through webpack proxy)
    : (process.env.REACT_APP_ADMIN_API_URL || "https://admin.beep.gov.pk");
const MINISTRIES_API_URL = `${ADMIN_API_BASE_URL}/api/ministries`;

let ministriesCache: Ministry[] | null = null;
let ministriesCachePromise: Promise<Ministry[]> | null = null;
const designationsCache = new Map<number, Designation[]>();
const designationsCachePromise = new Map<number, Promise<Designation[]>>();

/**
 * Fetches all ministries from the API
 * Uses caching to avoid multiple requests
 */
export async function fetchMinistries(): Promise<Ministry[]> {
    // Return cached data if available
    if (ministriesCache) {
        return ministriesCache;
    }

    // Return existing promise if fetch is in progress
    if (ministriesCachePromise) {
        return ministriesCachePromise;
    }

    // Start new fetch
    ministriesCachePromise = (async () => {
        try {
            const response = await fetch(MINISTRIES_API_URL);
            if (!response.ok) {
                throw new Error(`Failed to fetch ministries: ${response.status}`);
            }
            const data = await response.json();
            ministriesCache = data;
            return data;
        } catch (error) {
            logger.error("Failed to fetch ministries", error);
            ministriesCachePromise = null; // Reset promise on error
            return [];
        }
    })();

    return ministriesCachePromise;
}

/**
 * Extracts ministry code from user ID
 * Format: {username}_{ministry_code}_{suffix}
 * Example: "ahmer_nitb_dev" -> "nitb"
 * Example: "@ahmer_nitb_dev:ms.beep.gov.pk" -> "nitb"
 */
export function extractMinistryCodeFromUserId(userId: string): string | null {
    // Remove @ and domain if present (e.g., @ahmer_nitb_dev:ms.beep.gov.pk -> ahmer_nitb_dev)
    const localPart = userId.split(":")[0].replace("@", "");
    
    // Split by underscore
    const parts = localPart.split("_");
    
    // Need at least 2 parts (username and ministry code)
    if (parts.length < 2) {
        return null;
    }
    
    // The ministry code is typically the second part
    // Common patterns:
    // - username_ministrycode_suffix (e.g., "ahmer_nitb_dev" -> "nitb")
    // - username_ministrycode (e.g., "ahmer_nitb" -> "nitb")
    
    // Prefer the second part if it looks like a ministry code
    if (parts.length >= 2) {
        const potentialCode = parts[1].toLowerCase();
        // Ministry codes are typically short (2-10 chars) and alphanumeric
        if (potentialCode.length >= 2 && potentialCode.length <= 10 && /^[a-z0-9]+$/.test(potentialCode)) {
            return potentialCode;
        }
    }
    
    // Fallback: try other parts if second part doesn't match
    for (let i = 2; i < parts.length; i++) {
        const potentialCode = parts[i].toLowerCase();
        if (potentialCode.length >= 2 && potentialCode.length <= 10 && /^[a-z0-9]+$/.test(potentialCode)) {
            return potentialCode;
        }
    }
    
    return null;
}

/**
 * Gets ministry name by code
 */
export async function getMinistryNameByCode(code: string): Promise<string | null> {
    try {
        const ministries = await fetchMinistries();
        const ministry = ministries.find((m) => m.code.toLowerCase() === code.toLowerCase());
        return ministry ? ministry.name : null;
    } catch (error) {
        logger.error("Failed to get ministry name by code", error);
        return null;
    }
}

/**
 * Gets ministry information from user ID
 */
export async function getMinistryFromUserId(userId: string): Promise<Ministry | null> {
    const code = extractMinistryCodeFromUserId(userId);
    if (!code) {
        return null;
    }

    try {
        const ministries = await fetchMinistries();
        const ministry = ministries.find((m) => m.code.toLowerCase() === code.toLowerCase());
        return ministry || null;
    } catch (error) {
        logger.error("Failed to get ministry from user ID", error);
        return null;
    }
}

/**
 * Fetches designations for a specific ministry
 * Uses caching to avoid multiple requests
 */
export async function fetchDesignations(ministryId: number): Promise<Designation[]> {
    // Return cached data if available
    if (designationsCache.has(ministryId)) {
        return designationsCache.get(ministryId)!;
    }

    // Return existing promise if fetch is in progress
    if (designationsCachePromise.has(ministryId)) {
        return designationsCachePromise.get(ministryId)!;
    }

    // Start new fetch
    const promise = (async () => {
        try {
            const response = await fetch(`${ADMIN_API_BASE_URL}/api/ministries/${ministryId}/designations`);
            if (!response.ok) {
                throw new Error(`Failed to fetch designations: ${response.status}`);
            }
            const data = await response.json();
            designationsCache.set(ministryId, data);
            return data;
        } catch (error) {
            logger.error(`Failed to fetch designations for ministry ${ministryId}`, error);
            designationsCachePromise.delete(ministryId); // Reset promise on error
            return [];
        }
    })();

    designationsCachePromise.set(ministryId, promise);
    return promise;
}

/**
 * Extracts designation code from user ID
 * Format: {username}_{ministry_code}_{designation_code}
 * Example: "ahmer_nitb_dev" -> "dev"
 * Example: "ahmer_nitb_admin" -> "admin"
 */
export function extractDesignationCodeFromUserId(userId: string): string | null {
    // Remove @ and domain if present
    const localPart = userId.split(":")[0].replace("@", "");
    
    // Split by underscore
    const parts = localPart.split("_");
    
    // Need at least 3 parts (username, ministry code, designation code)
    if (parts.length < 3) {
        return null;
    }
    
    // The designation code is typically the third part (last part)
    // Common patterns:
    // - username_ministrycode_designationcode (e.g., "ahmer_nitb_dev" -> "dev")
    
    // Prefer the last part as designation code
    const potentialCode = parts[parts.length - 1].toLowerCase();
    // Designation codes are typically short (2-10 chars) and alphanumeric
    if (potentialCode.length >= 2 && potentialCode.length <= 10 && /^[a-z0-9]+$/.test(potentialCode)) {
        return potentialCode;
    }
    
    return null;
}

/**
 * Gets designation information from user ID and ministry
 */
export async function getDesignationFromUserId(
    userId: string,
    ministry: Ministry | null,
): Promise<Designation | null> {
    if (!ministry) {
        return null;
    }

    const designationCode = extractDesignationCodeFromUserId(userId);
    if (!designationCode) {
        return null;
    }

    try {
        const designations = await fetchDesignations(ministry.id);
        const designation = designations.find((d) => d.code.toLowerCase() === designationCode.toLowerCase());
        return designation || null;
    } catch (error) {
        logger.error("Failed to get designation from user ID", error);
        return null;
    }
}

/**
 * Gets designation information from account data or user ID
 * Checks account data first, then falls back to extracting from user ID
 */
export async function getUserDesignation(
    userId: string,
    ministry: Ministry | null,
    accountData?: { designation?: string } | null,
): Promise<Designation | null> {
    if (!ministry) {
        return null;
    }

    let designationCode: string | null = null;

    // Try to get designation from account data first
    if (accountData?.designation) {
        designationCode = accountData.designation.toLowerCase();
    } else {
        // Fallback to extracting from user ID
        designationCode = extractDesignationCodeFromUserId(userId);
    }

    if (!designationCode) {
        return null;
    }

    try {
        const designations = await fetchDesignations(ministry.id);
        const designation = designations.find((d) => d.code.toLowerCase() === designationCode!.toLowerCase());
        return designation || null;
    } catch (error) {
        logger.error("Failed to get user designation", error);
        return null;
    }
}
