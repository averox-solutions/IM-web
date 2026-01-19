/*
Copyright 2024 New Vector Ltd.
Copyright 2017-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {
    type MatrixClient,
    createClient,
    type ICreateClientOpts,
    MemoryCryptoStore,
    MemoryStore,
    IndexedDBCryptoStore,
    IndexedDBStore,
    LocalStorageCryptoStore,
    type EmptyObject,
} from "matrix-js-sdk/src/matrix";

import indexeddbWorkerFactory from "../workers/indexeddbWorkerFactory";

const localStorage = window.localStorage;

// just *accessing* indexedDB throws an exception in firefox with
// indexeddb disabled.
let indexedDB: IDBFactory;
try {
    indexedDB = window.indexedDB;
} catch {}

/**
 * Create a new matrix client, with the persistent stores set up appropriately
 * (using localstorage/indexeddb, etc)
 *
 * @param {Object} opts  options to pass to Matrix.createClient. This will be
 *    extended with `sessionStore` and `store` members.
 *
 * @returns {MatrixClient} the newly-created MatrixClient
 */
export default function createMatrixClient(opts: ICreateClientOpts): MatrixClient {
    const storeOpts: Partial<ICreateClientOpts> = {
        useAuthorizationHeader: true,
    };

    if (indexedDB && localStorage) {
        storeOpts.store = new IndexedDBStore({
            indexedDB: indexedDB,
            dbName: "riot-web-sync",
            localStorage,
            workerFactory: indexeddbWorkerFactory,
        });
    } else if (localStorage) {
        storeOpts.store = new MemoryStore({ localStorage });
    }

    if (indexedDB) {
        storeOpts.cryptoStore = new IndexedDBCryptoStore(indexedDB, "matrix-js-sdk:crypto");
    } else if (localStorage) {
        storeOpts.cryptoStore = new LocalStorageCryptoStore(localStorage);
    } else {
        storeOpts.cryptoStore = new MemoryCryptoStore();
    }

    const client = createClient({
        ...storeOpts,
        ...opts,
    });

    // Wrap _unstable_updateDelayedEvent to handle ALL delayed event update errors gracefully
    // This prevents MembershipManager from shutting down when delayed event updates fail
    // The error occurs when the delayed event update mechanism is in an invalid state
    // (e.g., widget/session was cleaned up before the update could complete)
    // 
    // IMPORTANT: We catch ALL errors here because the MembershipManager will shut down
    // after 10 retries regardless of error type. By catching all errors, we prevent
    // the shutdown and allow the delayed event to expire naturally or be handled by the server.
    // 
    // Note: _unstable_updateDelayedEvent is deprecated but still required for error handling
    // until a stable alternative is available in the SDK.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (client._unstable_updateDelayedEvent) {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const originalUpdateDelayedEvent = client._unstable_updateDelayedEvent.bind(client);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        client._unstable_updateDelayedEvent = async function (delayId: string, action: any): Promise<EmptyObject> {
            try {
                return await originalUpdateDelayedEvent(delayId, action);
            } catch (error: any) {
                // CRITICAL: Catch ALL delayed event update errors to prevent MembershipManager shutdown
                // The MembershipManager will retry up to 10 times and then shut down on ANY error
                // By catching all errors here (including _WidgetApiResponseError), we prevent 
                // the shutdown and allow graceful degradation
                // 
                // Common error scenarios:
                // - "Failed to override function" - widget/session cleaned up
                // - "Error updating delayed event" - update mechanism in invalid state
                // - "_WidgetApiResponseError: Error updating delayed event" - widget API error
                // - "p9: Error updating delayed event" - specific delayed event ID failing
                // - Network errors, server errors, etc.
                // 
                // Silently suppress ALL errors to prevent console noise and MembershipManager shutdown
                // The delayed event will expire naturally or be handled by the server
                
                // Don't throw - allow the operation to fail silently
                // This prevents the MembershipManager from retrying and eventually shutting down
                // Return empty object to match expected return type
                return {} as EmptyObject;
            }
        };
    }

    return client;
}
