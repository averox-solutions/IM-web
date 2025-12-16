// // // /*
// // // Copyright 2024 New Vector Ltd.
// // // Copyright 2022 The Matrix.org Foundation C.I.C.

// // // SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
// // // Please see LICENSE files in the repository root for full details.
// // // */

// // // import { ClientEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";
// // // import { logger } from "matrix-js-sdk/src/logger";

// // // import { canEncryptToAllUsers } from "../createRoom";
// // // import { Action } from "../dispatcher/actions";
// // // import { type ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
// // // import dis from "../dispatcher/dispatcher";
// // // import { type LocalRoom, LocalRoomState } from "../models/LocalRoom";
// // // import { waitForRoomReadyAndApplyAfterCreateCallbacks } from "./local-room";
// // // import { findDMRoom } from "./dm/findDMRoom";
// // // import { privateShouldBeEncrypted } from "./rooms";
// // // import { startDm } from "./dm/startDm";
// // // import { resolveThreePids } from "./threepids";

// // // /**
// // //  * Starts a DM immediately (without waiting for the first message).
// // //  *
// // //  * @async
// // //  * @param {MatrixClient} client
// // //  * @param {Member[]} targets The members to DM
// // //  * @returns {Promise<string | null>} Resolves to the created room id
// // //  */
// // // export async function startDmOnFirstMessage(client: MatrixClient, targets: Member[]): Promise<string | null> {
// // //     let resolvedTargets = targets;

// // //     try {
// // //         resolvedTargets = await resolveThreePids(targets, client);
// // //     } catch (e) {
// // //         logger.warn("Error resolving 3rd-party members", e);
// // //     }

// // //     // Check if a DM already exists
// // //     const existingRoom = findDMRoom(client, resolvedTargets);
// // //     if (existingRoom) {
// // //         dis.dispatch<ViewRoomPayload>({
// // //             action: Action.ViewRoom,
// // //             room_id: existingRoom.roomId,
// // //             should_peek: false,
// // //             joining: false,
// // //             metricsTrigger: "MessageUser",
// // //         });
// // //         return existingRoom.roomId;
// // //     }

// // //     // Create DM immediately
// // //     try {
// // //         const roomId = await startDm(client, resolvedTargets, false);
// // //         if (!roomId) throw new Error("Failed to create DM room");

// // //         dis.dispatch({
// // //             action: Action.ViewRoom,
// // //             room_id: roomId,
// // //             joining: false,
// // //         });

// // //         return roomId;
// // //     } catch (err) {
// // //         logger.error("Failed to create DM room immediately", err);
// // //         return null;
// // //     }
// // // }

// // // /**
// // //  * Starts a DM based on a local room.
// // //  * This still exists for backwards compatibility if local rooms are used elsewhere.
// // //  *
// // //  * @async
// // //  * @param {MatrixClient} client
// // //  * @param {LocalRoom} localRoom
// // //  * @returns {Promise<string | void>} Resolves to the created room id
// // //  */
// // // export async function createRoomFromLocalRoom(client: MatrixClient, localRoom: LocalRoom): Promise<string | void> {
// // //     if (!localRoom.isNew) {
// // //         return;
// // //     }

// // //     localRoom.state = LocalRoomState.CREATING;
// // //     client.emit(ClientEvent.Room, localRoom);

// // //     return startDm(client, localRoom.targets, false).then(
// // //         (roomId) => {
// // //             if (!roomId) throw new Error(`startDm for local room ${localRoom.roomId} didn't return a room Id`);

// // //             localRoom.actualRoomId = roomId;
// // //             return waitForRoomReadyAndApplyAfterCreateCallbacks(client, localRoom, roomId);
// // //         },
// // //         () => {
// // //             logger.warn(`Error creating DM for local room ${localRoom.roomId}`);
// // //             localRoom.state = LocalRoomState.ERROR;
// // //             client.emit(ClientEvent.Room, localRoom);
// // //         },
// // //     );
// // // }

// // // // Member interface and related classes
// // // export abstract class Member {
// // //     public abstract get name(): string;
// // //     public abstract get userId(): string;
// // //     public abstract getMxcAvatarUrl(): string | undefined;
// // // }

// // // export class DirectoryMember extends Member {
// // //     private readonly _userId: string;
// // //     private readonly displayName?: string;
// // //     private readonly avatarUrl?: string;

// // //     public constructor(userDirResult: { user_id: string; display_name?: string; avatar_url?: string }) {
// // //         super();
// // //         this._userId = userDirResult.user_id;
// // //         this.displayName = userDirResult.display_name;
// // //         this.avatarUrl = userDirResult.avatar_url;
// // //     }

// // //     public get name(): string {
// // //         return this.displayName || this._userId;
// // //     }

// // //     public get userId(): string {
// // //         return this._userId;
// // //     }

// // //     public getMxcAvatarUrl(): string | undefined {
// // //         return this.avatarUrl;
// // //     }
// // // }

// // // export class ThreepidMember extends Member {
// // //     private readonly id: string;

// // //     public constructor(id: string) {
// // //         super();
// // //         this.id = id;
// // //     }

// // //     public get isEmail(): boolean {
// // //         return this.id.includes("@");
// // //     }

// // //     public get name(): string {
// // //         return this.id;
// // //     }

// // //     public get userId(): string {
// // //         return this.id;
// // //     }

// // //     public getMxcAvatarUrl(): string | undefined {
// // //         return undefined;
// // //     }
// // // }

// // // export interface IDMUserTileProps {
// // //     member: Member;
// // //     onRemove?(member: Member): void;
// // // }

// // // /**
// // //  * Detects whether a room should be encrypted.
// // //  *
// // //  * @async
// // //  * @param {MatrixClient} client
// // //  * @param {Member[]} targets The members to check against
// // //  * @returns {Promise<boolean>}
// // //  */
// // // export async function determineCreateRoomEncryptionOption(client: MatrixClient, targets: Member[]): Promise<boolean> {
// // //     if (privateShouldBeEncrypted(client)) {
// // //         if (targets.length === 1 && targets[0] instanceof ThreepidMember) return true;

// // //         const has3PidMembers = targets.some((t) => t instanceof ThreepidMember);
// // //         if (!has3PidMembers) {
// // //             const targetIds = targets.map((t) => t.userId);
// // //             const allHaveDeviceKeys = await canEncryptToAllUsers(client, targetIds);
// // //             if (allHaveDeviceKeys) {
// // //                 return true;
// // //             }
// // //         }
// // //     }

// // //     return false;
// // // }
// // /*
// // Copyright 2024 New Vector Ltd.
// // Copyright 2022 The Matrix.org Foundation C.I.C.

// // SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
// // Please see LICENSE files in the repository root for full details.
// // */

// // import { ClientEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";
// // import { logger } from "matrix-js-sdk/src/logger";

// // import { canEncryptToAllUsers } from "../createRoom";
// // import { Action } from "../dispatcher/actions";
// // import { type ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
// // import dis from "../dispatcher/dispatcher";
// // import { type LocalRoom, LocalRoomState } from "../models/LocalRoom";
// // import { waitForRoomReadyAndApplyAfterCreateCallbacks } from "./local-room";
// // import { findDMRoom } from "./dm/findDMRoom";
// // import { privateShouldBeEncrypted } from "./rooms";
// // import { startDm } from "./dm/startDm";
// // import { resolveThreePids } from "./threepids";

// // /**
// //  * Starts or reopens a DM with proper m.direct update.
// //  * - Reuse existing DM if user is joined.
// //  * - If left, create a new DM and replace old entry in m.direct.
// //  * - If reused DM is empty, send placeholder message.
// //  *
// //  * @async
// //  * @param {MatrixClient} client
// //  * @param {Member[]} targets
// //  * @returns {Promise<string | null>} Resolves to the DM room id
// //  */
// // export async function startDmOnFirstMessage(client: MatrixClient, targets: Member[]): Promise<string | null> {
// //     let resolvedTargets = targets;

// //     try {
// //         resolvedTargets = await resolveThreePids(targets, client);
// //     } catch (e) {
// //         logger.warn("Error resolving 3rd-party members", e);
// //     }

// //     // ✅ Check for existing DM
// //     const existingRoom = findDMRoom(client, resolvedTargets);
// //     if (existingRoom) {
// //         const myMembership = existingRoom.getMyMembership();

// //         if (myMembership === "join") {
// //             // ✅ Reuse old DM
// //             dis.dispatch<ViewRoomPayload>({
// //                 action: Action.ViewRoom,
// //                 room_id: existingRoom.roomId,
// //                 should_peek: false,
// //                 joining: false,
// //                 metricsTrigger: "MessageUser",
// //             });

// //             // ✅ Send placeholder message if the room is empty
// //             if (existingRoom.timeline.length === 0) {
// //                 try {
// //                     await client.sendEvent(existingRoom.roomId, "m.room.message", {
// //                         msgtype: "m.text",
// //                         body: "Started a chat with you",
// //                     });
// //                 } catch (err) {
// //                     logger.error("Failed to send initial message in reused DM", err);
// //                 }
// //             }
// //             return existingRoom.roomId;
// //         }

// //         logger.info(`Existing DM found but membership is '${myMembership}', creating new DM.`);
// //     }

// //     // ✅ Create new DM immediately
// //     try {
// //         const roomId = await startDm(client, resolvedTargets, false);
// //         if (!roomId) throw new Error("Failed to create DM room");

// //         // ✅ Update m.direct (remove old and add new)
// //         const currentDirects = client.getAccountData("m.direct")?.getContent() || {};
// //         const userId = resolvedTargets[0].userId;
// //         currentDirects[userId] = [roomId]; // replace old entries

// //         try {
// //             await client.setAccountData("m.direct", currentDirects);
// //         } catch (err) {
// //             logger.error("Failed to update m.direct for DM", err);
// //         }

// //         // ✅ Open the new DM room
// //         dis.dispatch({
// //             action: Action.ViewRoom,
// //             room_id: roomId,
// //             joining: false,
// //         });

// //         return roomId;
// //     } catch (err) {
// //         logger.error("Failed to create DM room", err);
// //         return null;
// //     }
// // }

// // /**
// //  * Starts a DM based on a local room (legacy).
// //  * Creates DM immediately as well.
// //  */
// // export async function createRoomFromLocalRoom(client: MatrixClient, localRoom: LocalRoom): Promise<string | void> {
// //     if (!localRoom.isNew) return;

// //     localRoom.state = LocalRoomState.CREATING;
// //     client.emit(ClientEvent.Room, localRoom);

// //     return startDm(client, localRoom.targets, false).then(
// //         (roomId) => {
// //             if (!roomId) throw new Error(`startDm for local room ${localRoom.roomId} didn't return a room Id`);

// //             localRoom.actualRoomId = roomId;
// //             return waitForRoomReadyAndApplyAfterCreateCallbacks(client, localRoom, roomId);
// //         },
// //         () => {
// //             logger.warn(`Error creating DM for local room ${localRoom.roomId}`);
// //             localRoom.state = LocalRoomState.ERROR;
// //             client.emit(ClientEvent.Room, localRoom);
// //         },
// //     );
// // }

// // // ============================================================
// // // Member interfaces and implementations
// // // ============================================================

// // export abstract class Member {
// //     public abstract get name(): string;
// //     public abstract get userId(): string;
// //     public abstract getMxcAvatarUrl(): string | undefined;
// // }

// // export class DirectoryMember extends Member {
// //     private readonly _userId: string;
// //     private readonly displayName?: string;
// //     private readonly avatarUrl?: string;

// //     public constructor(userDirResult: { user_id: string; display_name?: string; avatar_url?: string }) {
// //         super();
// //         this._userId = userDirResult.user_id;
// //         this.displayName = userDirResult.display_name;
// //         this.avatarUrl = userDirResult.avatar_url;
// //     }

// //     public get name(): string {
// //         return this.displayName || this._userId;
// //     }

// //     public get userId(): string {
// //         return this._userId;
// //     }

// //     public getMxcAvatarUrl(): string | undefined {
// //         return this.avatarUrl;
// //     }
// // }

// // export class ThreepidMember extends Member {
// //     private readonly id: string;

// //     public constructor(id: string) {
// //         super();
// //         this.id = id;
// //     }

// //     public get isEmail(): boolean {
// //         return this.id.includes("@");
// //     }

// //     public get name(): string {
// //         return this.id;
// //     }

// //     public get userId(): string {
// //         return this.id;
// //     }

// //     public getMxcAvatarUrl(): string | undefined {
// //         return undefined;
// //     }
// // }

// // export interface IDMUserTileProps {
// //     member: Member;
// //     onRemove?(member: Member): void;
// // }

// // /**
// //  * Detects whether a room should be encrypted.
// //  */
// // export async function determineCreateRoomEncryptionOption(client: MatrixClient, targets: Member[]): Promise<boolean> {
// //     if (privateShouldBeEncrypted(client)) {
// //         if (targets.length === 1 && targets[0] instanceof ThreepidMember) return true;

// //         const has3PidMembers = targets.some((t) => t instanceof ThreepidMember);
// //         if (!has3PidMembers) {
// //             const targetIds = targets.map((t) => t.userId);
// //             const allHaveDeviceKeys = await canEncryptToAllUsers(client, targetIds);
// //             if (allHaveDeviceKeys) return true;
// //         }
// //     }

// //     return false;
// // }
// /*
// Copyright 2024 New Vector Ltd.
// Copyright 2022 The Matrix.org Foundation C.I.C.

// SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
// */

// import { ClientEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";
// import { logger } from "matrix-js-sdk/src/logger";

// import { canEncryptToAllUsers } from "../createRoom";
// import { Action } from "../dispatcher/actions";
// import { type ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
// import dis from "../dispatcher/dispatcher";
// import { type LocalRoom, LocalRoomState } from "../models/LocalRoom";
// import { waitForRoomReadyAndApplyAfterCreateCallbacks } from "./local-room";
// import { privateShouldBeEncrypted } from "./rooms";
// import { startDm } from "./dm/startDm";
// import { resolveThreePids } from "./threepids";

// /**
//  * Starts or reopens a DM.
//  * Rules:
//  * - If an old DM exists and you're joined → reuse it.
//  * - If old DM exists but you left → create a new DM and replace in m.direct.
//  * - Always ensure the new DM is mapped in m.direct for correct UI behavior.
//  * - If reusing and empty, send a placeholder message.
//  *
//  * @async
//  */
// export async function startDmOnFirstMessage(client: MatrixClient, targets: Member[]): Promise<string | null> {
//     let resolvedTargets = targets;

//     try {
//         resolvedTargets = await resolveThreePids(targets, client);
//     } catch (e) {
//         logger.warn("Error resolving 3rd-party members", e);
//     }

//     const userId = resolvedTargets[0].userId;

//     // ✅ Look for existing DM manually
//     const rooms = client.getRooms().filter(r => {
//         const dmMap = client.getAccountData("m.direct")?.getContent() || {};
//         const dmIds = dmMap[userId] || [];
//         return dmIds.includes(r.roomId);
//     });

//     if (rooms.length > 0) {
//         const existingRoom = rooms[0];
//         const membership = existingRoom.getMyMembership();

//         if (membership === "join") {
//             // ✅ Reuse old DM
//             dis.dispatch<ViewRoomPayload>({
//                 action: Action.ViewRoom,
//                 room_id: existingRoom.roomId,
//                 should_peek: false,
//                 joining: false,
//                 metricsTrigger: "MessageUser",
//             });

//             // ✅ If empty, send placeholder message
//             if (existingRoom.timeline.length === 0) {
//                 try {
//                     await client.sendEvent(existingRoom.roomId, "m.room.message", {
//                         msgtype: "m.text",
//                         body: "Started a chat with you",
//                     });
//                 } catch (err) {
//                     logger.error("Failed to send initial message in reused DM", err);
//                 }
//             }
//             return existingRoom.roomId;
//         }
//     }

//     // ✅ No valid DM found or you left the old one → create a new DM
//     try {
//         const roomId = await startDm(client, resolvedTargets, false);
//         if (!roomId) throw new Error("Failed to create DM room");

//         // ✅ Update m.direct (replace old mapping)
//         const directMap = client.getAccountData("m.direct")?.getContent() || {};
//         directMap[userId] = [roomId];
//         try {
//             await client.setAccountData("m.direct", directMap);
//         } catch (err) {
//             logger.error("Failed to update m.direct for DM", err);
//         }

//         dis.dispatch({
//             action: Action.ViewRoom,
//             room_id: roomId,
//             joining: false,
//         });

//         return roomId;
//     } catch (err) {
//         logger.error("Failed to create DM room", err);
//         return null;
//     }
// }

// /**
//  * Legacy: Creates DM immediately from LocalRoom.
//  */
// export async function createRoomFromLocalRoom(client: MatrixClient, localRoom: LocalRoom): Promise<string | void> {
//     if (!localRoom.isNew) return;

//     localRoom.state = LocalRoomState.CREATING;
//     client.emit(ClientEvent.Room, localRoom);

//     return startDm(client, localRoom.targets, false).then(
//         (roomId) => {
//             if (!roomId) throw new Error(`startDm for local room ${localRoom.roomId} didn't return a room Id`);

//             localRoom.actualRoomId = roomId;
//             return waitForRoomReadyAndApplyAfterCreateCallbacks(client, localRoom, roomId);
//         },
//         () => {
//             logger.warn(`Error creating DM for local room ${localRoom.roomId}`);
//             localRoom.state = LocalRoomState.ERROR;
//             client.emit(ClientEvent.Room, localRoom);
//         },
//     );
// }

// // ============================================================
// // Member interfaces and implementations
// // ============================================================

// export abstract class Member {
//     public abstract get name(): string;
//     public abstract get userId(): string;
//     public abstract getMxcAvatarUrl(): string | undefined;
// }

// export class DirectoryMember extends Member {
//     private readonly _userId: string;
//     private readonly displayName?: string;
//     private readonly avatarUrl?: string;

//     public constructor(userDirResult: { user_id: string; display_name?: string; avatar_url?: string }) {
//         super();
//         this._userId = userDirResult.user_id;
//         this.displayName = userDirResult.display_name;
//         this.avatarUrl = userDirResult.avatar_url;
//     }

//     public get name(): string {
//         return this.displayName || this._userId;
//     }

//     public get userId(): string {
//         return this._userId;
//     }

//     public getMxcAvatarUrl(): string | undefined {
//         return this.avatarUrl;
//     }
// }

// export class ThreepidMember extends Member {
//     private readonly id: string;

//     public constructor(id: string) {
//         super();
//         this.id = id;
//     }

//     public get isEmail(): boolean {
//         return this.id.includes("@");
//     }

//     public get name(): string {
//         return this.id;
//     }

//     public get userId(): string {
//         return this.id;
//     }

//     public getMxcAvatarUrl(): string | undefined {
//         return undefined;
//     }
// }

// export interface IDMUserTileProps {
//     member: Member;
//     onRemove?(member: Member): void;
// }

// /**
//  * Detects whether a room should be encrypted.
//  */
// export async function determineCreateRoomEncryptionOption(client: MatrixClient, targets: Member[]): Promise<boolean> {
//     if (privateShouldBeEncrypted(client)) {
//         if (targets.length === 1 && targets[0] instanceof ThreepidMember) return true;

//         const has3PidMembers = targets.some((t) => t instanceof ThreepidMember);
//         if (!has3PidMembers) {
//             const targetIds = targets.map((t) => t.userId);
//             const allHaveDeviceKeys = await canEncryptToAllUsers(client, targetIds);
//             if (allHaveDeviceKeys) return true;
//         }
//     }

//     return false;
// }
/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import { ClientEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { canEncryptToAllUsers } from "../createRoom";
import { Action } from "../dispatcher/actions";
import { type ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
import dis from "../dispatcher/dispatcher";
import { type LocalRoom, LocalRoomState } from "../models/LocalRoom";
import { waitForRoomReadyAndApplyAfterCreateCallbacks } from "./local-room";
import { privateShouldBeEncrypted } from "./rooms";
import { startDm } from "./dm/startDm";
import { resolveThreePids } from "./threepids";

/**
 * Starts or reopens a DM:
 * - Reuse existing DM if joined.
 * - Auto-invite other user if they left.
 * - Auto-join if user was invited but hasn't joined yet.
 * - Rejoin if user left but other user is still in the room.
 * - If you left old DM and other user also left → create a new DM and update m.direct.
 * - Send placeholder if reused DM is empty.
 *
 * @async
 */
export async function startDmOnFirstMessage(client: MatrixClient, targets: Member[]): Promise<string | null> {
    let resolvedTargets = targets;

    try {
        resolvedTargets = await resolveThreePids(targets, client);
    } catch (e) {
        logger.warn("Error resolving 3rd-party members", e);
    }

    const userId = resolvedTargets[0].userId;

    // ✅ Check for old DM from m.direct mapping
    const directMap = client.getAccountData("m.direct")?.getContent() || {};
    const oldRoomIds = directMap[userId] || [];
    const rooms = client.getRooms().filter(r => oldRoomIds.includes(r.roomId));

    if (rooms.length > 0) {
        const existingRoom = rooms[0];
        const myMembership = existingRoom.getMyMembership();

        if (myMembership === "join") {
            // ✅ If other user left, re-invite them
            const member = existingRoom.getMember(userId);
            if (!member || member.membership === "leave") {
                try {
                    await client.invite(existingRoom.roomId, userId);
                    logger.info(`Re-invited ${userId} to DM ${existingRoom.roomId}`);
                } catch (err) {
                    logger.error(`Failed to re-invite ${userId}`, err);
                }
            }

            // ✅ Open the existing DM
            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: existingRoom.roomId,
                should_peek: false,
                joining: false,
                metricsTrigger: "MessageUser",
            });

            // ✅ Send placeholder if empty
            if (existingRoom.timeline.length === 0) {
                try {
                    await client.sendEvent(existingRoom.roomId, "m.room.message", {
                        msgtype: "m.text",
                        body: "Started a chat with you",
                    });
                } catch (err) {
                    logger.error("Failed to send initial message in reused DM", err);
                }
            }
            return existingRoom.roomId;
        } else if (myMembership === KnownMembership.Invite) {
            // ✅ User was invited but hasn't joined - auto-join without invitation
            try {
                await client.joinRoom(existingRoom.roomId);
                logger.info(`Auto-joined existing DM ${existingRoom.roomId} for ${userId}`);

                // ✅ Open the existing DM
                dis.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_id: existingRoom.roomId,
                    should_peek: false,
                    joining: false,
                    metricsTrigger: "MessageUser",
                });

                return existingRoom.roomId;
            } catch (err) {
                logger.error(`Failed to auto-join existing DM ${existingRoom.roomId}`, err);
                // Fall through to create new DM if join fails
            }
        } else if (myMembership === KnownMembership.Leave) {
            // ✅ User left the room - check if other user is still there and rejoin
            const otherMember = existingRoom.getMember(userId);
            if (otherMember && (otherMember.membership === KnownMembership.Join || otherMember.membership === KnownMembership.Invite)) {
                // Other user is still in the room (joined or invited) - rejoin without invitation
                try {
                    await client.joinRoom(existingRoom.roomId);
                    logger.info(`Rejoined existing DM ${existingRoom.roomId} for ${userId}`);

                    // ✅ If other user was invited but not joined, they'll be auto-joined when they come back
                    // ✅ Open the existing DM
                    dis.dispatch<ViewRoomPayload>({
                        action: Action.ViewRoom,
                        room_id: existingRoom.roomId,
                        should_peek: false,
                        joining: false,
                        metricsTrigger: "MessageUser",
                    });

                    return existingRoom.roomId;
                } catch (err) {
                    logger.error(`Failed to rejoin existing DM ${existingRoom.roomId}`, err);
                    // Fall through to create new DM if rejoin fails
                }
            }
        }
    }

    // ✅ Create new DM because old one is invalid or user left
    try {
        const roomId = await startDm(client, resolvedTargets, false);
        if (!roomId) throw new Error("Failed to create DM room");

        // ✅ Update m.direct to mark this as the new DM
        const updatedDirectMap = { ...directMap, [userId]: [roomId] };
        try {
            await client.setAccountData("m.direct", updatedDirectMap);
        } catch (err) {
            logger.error("Failed to update m.direct for DM", err);
        }

        // ✅ Open the new DM
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: roomId,
            joining: false,
        });

        return roomId;
    } catch (err) {
        logger.error("Failed to create DM room", err);
        return null;
    }
}

/**
 * Legacy: Creates DM immediately from LocalRoom.
 */
export async function createRoomFromLocalRoom(client: MatrixClient, localRoom: LocalRoom): Promise<string | void> {
    if (!localRoom.isNew) return;

    localRoom.state = LocalRoomState.CREATING;
    client.emit(ClientEvent.Room, localRoom);

    return startDm(client, localRoom.targets, false).then(
        (roomId) => {
            if (!roomId) throw new Error(`startDm for local room ${localRoom.roomId} didn't return a room Id`);

            localRoom.actualRoomId = roomId;
            return waitForRoomReadyAndApplyAfterCreateCallbacks(client, localRoom, roomId);
        },
        () => {
            logger.warn(`Error creating DM for local room ${localRoom.roomId}`);
            localRoom.state = LocalRoomState.ERROR;
            client.emit(ClientEvent.Room, localRoom);
        },
    );
}

// ============================================================
// Member interfaces and implementations
// ============================================================

export abstract class Member {
    public abstract get name(): string;
    public abstract get userId(): string;
    public abstract getMxcAvatarUrl(): string | undefined;
}

export class DirectoryMember extends Member {
    private readonly _userId: string;
    private readonly displayName?: string;
    private readonly avatarUrl?: string;

    public constructor(userDirResult: { user_id: string; display_name?: string; avatar_url?: string }) {
        super();
        this._userId = userDirResult.user_id;
        this.displayName = userDirResult.display_name;
        this.avatarUrl = userDirResult.avatar_url;
    }

    public get name(): string {
        return this.displayName || this._userId;
    }

    public get userId(): string {
        return this._userId;
    }

    public getMxcAvatarUrl(): string | undefined {
        return this.avatarUrl;
    }
}

export class ThreepidMember extends Member {
    private readonly id: string;

    public constructor(id: string) {
        super();
        this.id = id;
    }

    public get isEmail(): boolean {
        return this.id.includes("@");
    }

    public get name(): string {
        return this.id;
    }

    public get userId(): string {
        return this.id;
    }

    public getMxcAvatarUrl(): string | undefined {
        return undefined;
    }
}

export interface IDMUserTileProps {
    member: Member;
    onRemove?(member: Member): void;
}

/**
 * Detects whether a room should be encrypted.
 */
export async function determineCreateRoomEncryptionOption(client: MatrixClient, targets: Member[]): Promise<boolean> {
    if (privateShouldBeEncrypted(client)) {
        if (targets.length === 1 && targets[0] instanceof ThreepidMember) return true;

        const has3PidMembers = targets.some((t) => t instanceof ThreepidMember);
        if (!has3PidMembers) {
            const targetIds = targets.map((t) => t.userId);
            const allHaveDeviceKeys = await canEncryptToAllUsers(client, targetIds);
            if (allHaveDeviceKeys) return true;
        }
    }

    return false;
}
