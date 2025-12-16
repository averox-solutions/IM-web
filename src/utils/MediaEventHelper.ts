/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, EventType, MsgType } from "matrix-js-sdk/src/matrix";
import { type MatrixError } from "matrix-js-sdk/src/http-api";
import { type FileContent, type ImageContent, type MediaEventContent } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import { LazyValue } from "./LazyValue";
import { type Media, mediaFromContent } from "../customisations/Media";
import { decryptFile, DownloadError } from "./DecryptFile";
import { type IDestroyable } from "./IDestroyable";
import {
    loadMediaBlobFromCache,
    mediaCacheKeyFor,
    persistMediaBlob,
    type MediaCachePart,
} from "./MediaCacheStore";
import { loadLocalMediaBlob } from "./LocalMediaCache";

// TODO: We should consider caching the blobs. https://github.com/vector-im/element-web/issues/17192

export class MediaEventHelper implements IDestroyable {
    // Either an HTTP or Object URL (when encrypted) to the media.
    public readonly sourceUrl: LazyValue<string | null>;
    public readonly thumbnailUrl: LazyValue<string | null>;

    // Either the raw or decrypted (when encrypted) contents of the file.
    public readonly sourceBlob: LazyValue<Blob>;
    public readonly thumbnailBlob: LazyValue<Blob | null>;

    public readonly media: Media;

    public constructor(private event: MatrixEvent) {
        this.sourceUrl = new LazyValue(this.prepareSourceUrl);
        this.thumbnailUrl = new LazyValue(this.prepareThumbnailUrl);
        this.sourceBlob = new LazyValue(this.fetchSource);
        this.thumbnailBlob = new LazyValue(this.fetchThumbnail);

        this.media = mediaFromContent(this.event.getContent());
    }

    public get fileName(): string {
        const content = this.event.getContent<MediaEventContent>();
        const voiceFileName = content["org.matrix.msc1767.file"]?.name;
        return content.filename || voiceFileName || content.body || "download";
    }

    public destroy(): void {
        if (this.media.isEncrypted) {
            if (this.sourceUrl.cachedValue) URL.revokeObjectURL(this.sourceUrl.cachedValue);
            if (this.thumbnailUrl.cachedValue) URL.revokeObjectURL(this.thumbnailUrl.cachedValue);
        }
    }

    private prepareSourceUrl = async (): Promise<string | null> => {
        if (this.media.isEncrypted) {
            const blob = await this.sourceBlob.value;
            return URL.createObjectURL(blob);
        } else {
            return this.media.srcHttp;
        }
    };

    private prepareThumbnailUrl = async (): Promise<string | null> => {
        if (this.media.isEncrypted) {
            const blob = await this.thumbnailBlob.value;
            if (blob === null) return null;
            return URL.createObjectURL(blob);
        } else {
            return this.media.thumbnailHttp;
        }
    };

    private fetchSource = async (): Promise<Blob> => {
        const blob = await this.fetchAndCacheMedia("source", async () => {
        if (this.media.isEncrypted) {
            const content = this.event.getContent<MediaEventContent>();
            return decryptFile(content.file!, content.info);
        }
            const response = await this.media.downloadSource();
            return response.blob();
        });
        if (!blob) {
            throw new Error("Failed to load media source");
        }
        return blob;
    };

    private fetchThumbnail = async (): Promise<Blob | null> => {
        if (!this.media.hasThumbnail) return null;

        const blob = await this.fetchAndCacheMedia("thumbnail", async () => {
        if (this.media.isEncrypted) {
            const content = this.event.getContent<ImageContent>();
            if (content.info?.thumbnail_file) {
                return decryptFile(content.info.thumbnail_file, content.info.thumbnail_info);
                }
                // "Should never happen"
                logger.warn("Media claims to have thumbnail and is encrypted, but no thumbnail_file found");
                return null;
        }

        const thumbnailHttp = this.media.thumbnailHttp;
            if (!thumbnailHttp) return null;

            const response = await fetch(thumbnailHttp);
            return response.blob();
        });

        return blob;
    };

    private async fetchAndCacheMedia(part: MediaCachePart, fetcher: () => Promise<Blob | null>): Promise<Blob | null> {
        const cacheKey = mediaCacheKeyFor(part, {
            eventId: this.event.getId(),
            txnId: this.event.getTxnId(),
            mxc: this.media.srcMxc,
        });
        if (cacheKey) {
            const cachedBlob = await loadMediaBlobFromCache(cacheKey);
            if (cachedBlob) {
                return cachedBlob;
            }

            const localBlob = await loadLocalMediaBlob(cacheKey);
            if (localBlob) {
                return localBlob;
            }
        }

        const blob = await this.fetchWithRetry(fetcher, cacheKey);
        if (!blob || !cacheKey) {
            return blob;
        }

        await persistMediaBlob({
            identifiers: {
                eventId: this.event.getId(),
                txnId: this.event.getTxnId(),
                mxc: this.media.srcMxc,
            },
            blob,
            eventId: this.event.getId(),
            roomId: this.event.getRoomId(),
            mxc: this.media.srcMxc,
            mimeType: this.getMimeTypeForPart(part) ?? blob.type,
            size: blob.size,
            part,
        });

        return blob;
    }

    private async fetchWithRetry(
        fetcher: () => Promise<Blob | null>,
        cacheKey: string | null,
        maxAttempts = 6,
    ): Promise<Blob | null> {
        let attempt = 0;
        let lastError: unknown;
        while (attempt < maxAttempts) {
            try {
                return await fetcher();
            } catch (error) {
                lastError = error;
                attempt++;
                if (!this.shouldRetryDownload(error, cacheKey) || attempt >= maxAttempts) {
                    throw error;
                }
                const delay = this.getRetryDelay(attempt);
                await new Promise((resolve) => window.setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }

    private getRetryDelay(attempt: number): number {
        const base = 1000; // 1s
        const delay = base * Math.pow(2, attempt - 1); // exponential backoff
        return Math.min(delay, 15000); // cap at 15s between attempts
    }

    private shouldRetryDownload(error: unknown, cacheKey?: string | null): boolean {
        if (error instanceof DownloadError) {
            if (this.maybePendingUpload(cacheKey, error.cause)) {
                return true;
            }
            return this.isNotFoundError(error.cause);
        }
        if (this.maybePendingUpload(cacheKey, error)) {
            return true;
        }
        return this.isNotFoundError(error);
    }

    private maybePendingUpload(cacheKey: string | null | undefined, error: unknown): boolean {
        if (!cacheKey) return false;
        const txnId = this.event.getTxnId();
        if (!txnId) return false;
        if (!cacheKey.includes(txnId)) return false;
        return this.isNotFoundError(error);
    }
    private isNotFoundError(error: unknown): boolean {
        const httpError = error as { httpStatus?: number };
        if (typeof httpError?.httpStatus === "number") {
            return httpError.httpStatus === 404;
        }

        const matrixError = error as MatrixError;
        return matrixError?.httpStatus === 404;
    }

    private getMimeTypeForPart(part: MediaCachePart): string | undefined {
        const content = this.event.getContent<ImageContent>();
        if (part === "thumbnail") {
            return content.info?.thumbnail_info?.mimetype ?? undefined;
        }
        return content.info?.mimetype ?? undefined;
    }

    public static isEligible(event: MatrixEvent): boolean {
        if (!event) return false;
        if (event.isRedacted()) return false;
        if (event.getType() === EventType.Sticker) return true;
        if (event.getType() !== EventType.RoomMessage) return false;

        const content = event.getContent();
        const mediaMsgTypes: string[] = [MsgType.Video, MsgType.Audio, MsgType.Image, MsgType.File];
        if (mediaMsgTypes.includes(content.msgtype!)) return true;
        if (typeof content.url === "string") return true;

        // Finally, it's probably not media
        return false;
    }
}
