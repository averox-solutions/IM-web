/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

declare module "livekit-client" {
    export class E2EEWorker {
        public constructor();
    }
}

declare module "livekit-client/e2ee-worker" {
    const worker: Worker & { default?: Worker };
    export default worker;
}
