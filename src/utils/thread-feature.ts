/*
Copyright 2024 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SdkConfig from "../SdkConfig";

/**
 * Returns true when thread functionality should be available.
 * Controlled via the `enable_threads` flag in config.json (defaults to true).
 */
export function areThreadsEnabled(): boolean {
    return SdkConfig.get("enable_threads") !== false;
}


