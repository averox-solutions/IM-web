/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 , 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Retrieves the IndexedDB factory object.
 *
 * @returns {IDBFactory | undefined} The IndexedDB factory object if available, or undefined if it is not supported.
 */
export const IDB_DATABASE_NAME = "matrix-react-sdk";
export const IDB_DATABASE_VERSION = 2;

export function getIDBFactory(): IDBFactory | undefined {
    // IndexedDB loading is lazy for easier testing.

    // just *accessing* _indexedDB throws an exception in firefox with
    // indexeddb disabled.
    try {
        // `self` is preferred for service workers, which access this file's functions.
        // We check `self` first because `window` returns something which doesn't work for service workers.
        // Note: `self?.indexedDB ?? window.indexedDB` breaks in service workers for unknown reasons.
        return self?.indexedDB ? self.indexedDB : window.indexedDB;
    } catch {}
}

let idb: IDBDatabase | null = null;

async function idbInit(): Promise<void> {
    if (!getIDBFactory()) {
        throw new Error("IndexedDB not available");
    }
    idb = await new Promise((resolve, reject) => {
        const openRequest = getIDBFactory()!.open(IDB_DATABASE_NAME, IDB_DATABASE_VERSION);
        openRequest.onerror = reject;
        openRequest.onsuccess = (): void => {
            resolve(openRequest.result);
        };
        openRequest.onupgradeneeded = (event): void => {
            const db = openRequest.result;

            if (!db.objectStoreNames.contains("pickleKey")) {
                db.createObjectStore("pickleKey");
            }

            if (!db.objectStoreNames.contains("account")) {
                db.createObjectStore("account");
            }

            let mediaStore: IDBObjectStore;
            if (db.objectStoreNames.contains("mediaCache")) {
                mediaStore = openRequest.transaction!.objectStore("mediaCache");
            } else {
                mediaStore = db.createObjectStore("mediaCache", { keyPath: "key" });
            }
            if (!mediaStore.indexNames.contains("byUpdated")) {
                mediaStore.createIndex("byUpdated", "updated", { unique: false });
            }

            // Close older connections holding on to outdated versions.
            if (event?.oldVersion && event.oldVersion < IDB_DATABASE_VERSION && idb) {
                idb.close();
            }
        };
    });
}

async function idbTransaction(
    table: string,
    mode: IDBTransactionMode,
    fn: (objectStore: IDBObjectStore) => IDBRequest<any>,
): Promise<any> {
    if (!idb) {
        await idbInit();
    }
    return new Promise((resolve, reject) => {
        const txn = idb!.transaction([table], mode);
        txn.onerror = reject;

        const objectStore = txn.objectStore(table);
        const request = fn(objectStore);
        request.onerror = reject;
        request.onsuccess = (): void => {
            resolve(request.result);
        };
    });
}

/**
 * Loads an item from an IndexedDB table within the underlying `matrix-react-sdk` database.
 *
 * If IndexedDB access is not supported in the environment, an error is thrown.
 *
 * @param {string} table The name of the object store in IndexedDB.
 * @param {string | string[]} key The key where the data is stored.
 * @returns {Promise<any>} A promise that resolves with the retrieved item from the table.
 */
export async function idbLoad(table: string, key: string | string[]): Promise<any> {
    if (!idb) {
        await idbInit();
    }
    return idbTransaction(table, "readonly", (objectStore) => objectStore.get(key));
}

/**
 * Saves data to an IndexedDB table within the underlying `matrix-react-sdk` database.
 *
 * If IndexedDB access is not supported in the environment, an error is thrown.
 *
 * @param {string} table The name of the object store in the IndexedDB.
 * @param {string|string[]} key The key to use for storing the data.
 * @param {*} data The data to be saved.
 * @returns {Promise<void>} A promise that resolves when the data is saved successfully.
 */
export async function idbSave(table: string, key: string | string[], data: any): Promise<void> {
    if (!idb) {
        await idbInit();
    }
    return idbTransaction(table, "readwrite", (objectStore) => objectStore.put(data, key));
}

/**
 * Deletes a record from an IndexedDB table within the underlying `matrix-react-sdk` database.
 *
 * If IndexedDB access is not supported in the environment, an error is thrown.
 *
 * @param {string} table The name of the object store where the record is stored.
 * @param {string|string[]} key The key of the record to be deleted.
 * @returns {Promise<void>} A Promise that resolves when the record(s) have been successfully deleted.
 */
export async function idbDelete(table: string, key: string | string[]): Promise<void> {
    if (!idb) {
        await idbInit();
    }
    return idbTransaction(table, "readwrite", (objectStore) => objectStore.delete(key));
}

/**
 * Clears all records from an IndexedDB table within the underlying `matrix-react-sdk` database.
 *
 * If IndexedDB access is not supported in the environment, an error is thrown.
 *
 * @param {string} table The name of the object store where the records are stored.
 * @returns {Promise<void>} A Promise that resolves when the record(s) have been successfully deleted.
 */
export async function idbClear(table: string): Promise<void> {
    if (!idb) {
        await idbInit();
    }
    return idbTransaction(table, "readwrite", (objectStore) => objectStore.clear());
}

/**
 * Provides direct access to the shared IndexedDB instance for advanced use cases
 * which cannot be covered by the helper functions above.
 *
 * @returns {Promise<IDBDatabase>} Resolves with the opened database instance.
 */
export async function getIdbDatabase(): Promise<IDBDatabase> {
    if (!idb) {
        await idbInit();
    }
    return idb!;
}
