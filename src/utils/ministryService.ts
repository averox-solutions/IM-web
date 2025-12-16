/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export interface Ministry {
    id: string;
    name: string;
    code: string;
    description?: string;
    isActive: boolean;
}

export interface MinistryResponse {
    success: boolean;
    data: Ministry[];
    message?: string;
}

const WEB_API_KEY = process.env.WEB_API_KEY;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Fetch all ministries from the database
 */
export async function fetchMinistries(): Promise<Ministry[]> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/ministries`, {
            method: "GET",
            headers: {
                "x-api-key": WEB_API_KEY,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch ministries: ${response.status} ${response.statusText}`);
        }

        const result: MinistryResponse = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || "Failed to fetch ministries");
        }

        return result.data || [];
    } catch (error) {
        console.error("Error fetching ministries:", error);
        // Return empty array on error to prevent login from breaking
        return [];
    }
}

/**
 * Fetch ministries with error handling and fallback
 */
export async function fetchMinistriesWithFallback(): Promise<Ministry[]> {
    try {
        const ministries = await fetchMinistries();
        
        // If no ministries returned, provide some fallback data
        if (ministries.length === 0) {
            console.warn("No ministries found, using fallback data");
            return [
                {
                    id: "1",
                    name: "Ministry of Information Technology",
                    code: "MOIT",
                    description: "Ministry of Information Technology and Telecommunication",
                    isActive: true,
                },
                {
                    id: "2", 
                    name: "Ministry of Health",
                    code: "MOH",
                    description: "Ministry of National Health Services",
                    isActive: true,
                },
                {
                    id: "3",
                    name: "Ministry of Education",
                    code: "MOE", 
                    description: "Ministry of Federal Education and Professional Training",
                    isActive: true,
                },
            ];
        }
        
        return ministries;
    } catch (error) {
        console.error("Error in fetchMinistriesWithFallback:", error);
        // Return fallback data on error
        return [
            {
                id: "1",
                name: "Ministry of Information Technology",
                code: "MOIT",
                description: "Ministry of Information Technology and Telecommunication",
                isActive: true,
            },
            {
                id: "2", 
                name: "Ministry of Health",
                code: "MOH",
                description: "Ministry of National Health Services",
                isActive: true,
            },
            {
                id: "3",
                name: "Ministry of Education",
                code: "MOE", 
                description: "Ministry of Federal Education and Professional Training",
                isActive: true,
            },
        ];
    }
}





