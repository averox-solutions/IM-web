/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import { getIdbDatabase, getIDBFactory } from "./StorageAccess";
import { saveLocalMediaBlob } from "./LocalMediaCache";

const MEDIA_CACHE_STORE = "mediaCache";

export type MediaCachePart = "source" | "thumbnail";
export interface MediaCacheKeySources {
    eventId?: string | null;
    txnId?: string | null;
    mxc?: string | null;
}

export interface MediaCacheMetadata {
    eventId?: string | null;
    roomId?: string | null;
    mxc?: string | null;
    mimeType?: string;
    size?: number;
    part: MediaCachePart;
}

interface MediaCacheRecord extends MediaCacheMetadata {
    key: string;
    blob: Blob;
    updated: number;
}

async function assertIndexedDbAvailable(): Promise<void> {
    if (!getIDBFactory()) {
        throw new Error("IndexedDB not available");
    }
}

async function withMediaCacheStore<T>(
    mode: IDBTransactionMode,
    fn: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    await assertIndexedDbAvailable();
    const db = await getIdbDatabase();

    return await new Promise<T>((resolve, reject) => {
        const txn = db.transaction([MEDIA_CACHE_STORE], mode);
        txn.onerror = (): void => {
            reject(txn.error ?? new Error("Unknown IndexedDB transaction error"));
        };

        const store = txn.objectStore(MEDIA_CACHE_STORE);
        const request = fn(store);
        request.onsuccess = (): void => {
            resolve(request.result);
        };
        request.onerror = (): void => {
            reject(request.error ?? new Error("Unknown IndexedDB request error"));
        };
    });
}

export async function loadMediaBlobFromCache(key: string): Promise<Blob | null> {
    try {
        const record = (await withMediaCacheStore<MediaCacheRecord | undefined>("readonly", (store) =>
            store.get(key),
        )) as MediaCacheRecord | undefined;
        return record?.blob ?? null;
    } catch (error) {
        logger.warn("Unable to read media from IndexedDB cache", error);
        return null;
    }
}

export interface MediaCacheSavePayload extends MediaCacheMetadata {
    key: string;
    blob: Blob;
}

export async function saveMediaBlobToCache(payload: MediaCacheSavePayload): Promise<void> {
    try {
        const record: MediaCacheRecord = {
            key: payload.key,
            blob: payload.blob,
            updated: Date.now(),
            eventId: payload.eventId,
            roomId: payload.roomId,
            mxc: payload.mxc,
            mimeType: payload.mimeType ?? payload.blob.type,
            size: payload.size ?? payload.blob.size,
            part: payload.part,
        };

        await withMediaCacheStore("readwrite", (store) => store.put(record));
    } catch (error) {
        logger.warn("Unable to persist media into IndexedDB cache", error);
    }
}

export function mediaCacheKeyFor(part: MediaCachePart, sources: MediaCacheKeySources): string | null {
    const identifier = sources.mxc ?? sources.eventId ?? sources.txnId;
    if (!identifier) return null;
    return `${identifier}:${part}`;
}

export interface PersistMediaBlobOptions extends MediaCacheMetadata {
    identifiers: MediaCacheKeySources;
    blob: Blob;
}

export async function persistMediaBlob(options: PersistMediaBlobOptions): Promise<void> {
    const key = mediaCacheKeyFor(options.part, options.identifiers);
    if (!key) return;

    await saveMediaBlobToCache({
        key,
        blob: options.blob,
        part: options.part,
        eventId: options.eventId ?? options.identifiers.eventId,
        roomId: options.roomId,
        mxc: options.mxc ?? options.identifiers.mxc,
        mimeType: options.mimeType ?? options.blob.type,
        size: options.size ?? options.blob.size,
    });

    await saveLocalMediaBlob(key, options.blob);
}

