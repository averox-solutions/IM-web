/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";

import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { fetchDeletedEventsForRoom } from "../utils/room/deleteForMe";

const CHANGE_EVENT = "change";

export class DeletedEventsStore extends EventEmitter {
    private static instance: DeletedEventsStore;

    // roomId -> set of deleted event IDs
    private deletedByRoom = new Map<string, Set<string>>();

    private constructor() {
        super();
    }

    public static getInstance(): DeletedEventsStore {
        if (!DeletedEventsStore.instance) {
            DeletedEventsStore.instance = new DeletedEventsStore();
        }
        return DeletedEventsStore.instance;
    }

    public isDeleted(roomId: string, eventId: string): boolean {
        const set = this.deletedByRoom.get(roomId);
        return !!set && set.has(eventId);
    }

    public getDeletedForRoom(roomId: string): Set<string> | undefined {
        return this.deletedByRoom.get(roomId);
    }

    public setDeletedForRoom(roomId: string, eventIds: string[]): void {
        this.deletedByRoom.set(roomId, new Set(eventIds));
        this.emit(CHANGE_EVENT, roomId);
    }

    public async loadRoom(client: MatrixClient, roomId: string): Promise<void> {
        // Avoid refetching if we already have data for this room.
        if (this.deletedByRoom.has(roomId)) {
            return;
        }

        const res = await fetchDeletedEventsForRoom(client, roomId);
        if (!res) {
            logger.warn(`[DeletedEventsStore] No deleted events data for room ${roomId}`);
            return;
        }

        this.deletedByRoom.set(roomId, new Set(res.deleted_events));
        this.emit(CHANGE_EVENT, roomId);
    }

    public markDeleted(roomId: string, eventId: string): void {
        let set = this.deletedByRoom.get(roomId);
        if (!set) {
            set = new Set<string>();
            this.deletedByRoom.set(roomId, set);
        }
        if (!set.has(eventId)) {
            set.add(eventId);
            this.emit(CHANGE_EVENT, roomId);
        }
    }

    public unmarkDeleted(roomId: string, eventId: string): void {
        const set = this.deletedByRoom.get(roomId);
        if (!set) return;

        if (set.delete(eventId)) {
            this.emit(CHANGE_EVENT, roomId);
        }
    }

    public addRoomListener(roomId: string, fn: () => void): () => void {
        const handler = (changedRoomId: string): void => {
            if (changedRoomId === roomId) {
                fn();
            }
        };

        this.on(CHANGE_EVENT, handler);
        return () => this.off(CHANGE_EVENT, handler);
    }
}


