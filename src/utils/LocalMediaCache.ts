/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import { getIDBFactory } from "./StorageAccess";

const LOCAL_DB_NAME = "localindex.db";
const LOCAL_DB_VERSION = 1;
const LOCAL_MEDIA_STORE = "media";

let localDb: IDBDatabase | null = null;

async function ensureLocalDb(): Promise<IDBDatabase> {
    if (localDb) {
        return localDb;
    }

    const factory = getIDBFactory();
    if (!factory) {
        throw new Error("IndexedDB not available");
    }

    localDb = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = factory.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);

        request.onerror = (): void => reject(request.error ?? new Error("Unable to open localindex.db"));
        request.onsuccess = (): void => resolve(request.result);
        request.onupgradeneeded = (): void => {
            const db = request.result;
            if (!db.objectStoreNames.contains(LOCAL_MEDIA_STORE)) {
                db.createObjectStore(LOCAL_MEDIA_STORE, { keyPath: "key" });
            }
        };
    });

    return localDb;
}

async function withLocalStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const db = await ensureLocalDb();

    return await new Promise<T>((resolve, reject) => {
        const txn = db.transaction([LOCAL_MEDIA_STORE], mode);
        txn.onerror = (): void => reject(txn.error ?? new Error("Unknown localindex transaction error"));

        const store = txn.objectStore(LOCAL_MEDIA_STORE);
        const request = fn(store);
        request.onsuccess = (): void => resolve(request.result);
        request.onerror = (): void => reject(request.error ?? new Error("Unknown localindex request error"));
    });
}

export async function saveLocalMediaBlob(key: string, blob: Blob): Promise<void> {
    try {
        await withLocalStore("readwrite", (store) =>
            store.put({
                key,
                blob,
                updated: Date.now(),
                mimeType: blob.type,
                size: blob.size,
            }),
        );
    } catch (error) {
        logger.warn("Unable to persist media into localindex.db", error);
    }
}

export async function loadLocalMediaBlob(key: string): Promise<Blob | null> {
    try {
        const record = (await withLocalStore<{ blob: Blob } | undefined>("readonly", (store) =>
            store.get(key),
        )) as { blob: Blob } | undefined;
        return record?.blob ?? null;
    } catch (error) {
        logger.warn("Unable to read media from localindex.db", error);
        return null;
    }
}

