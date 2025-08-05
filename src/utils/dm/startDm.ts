// // // /*
// // // Copyright 2024 New Vector Ltd.
// // // SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
// // // */

// // // import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
// // // import { type Optional } from "matrix-events-sdk";
// // // import { Action } from "../../dispatcher/actions";
// // // import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
// // // import { determineCreateRoomEncryptionOption, type Member } from "../direct-messages";
// // // import { isLocalRoom } from "../localRoom/isLocalRoom";
// // // import dis from "../../dispatcher/dispatcher";
// // // import createRoom, { type IOpts } from "../../createRoom";
// // // import { findDMForUser } from "./findDMForUser";

// // // /**
// // //  * Starts a direct message room with a single target user.
// // //  * Always enforces 1:1 behavior to avoid accidental group creation.
// // //  *
// // //  * @param client Matrix client instance
// // //  * @param targets List of members to DM (only first is used)
// // //  * @param showSpinner Whether to show loading spinner
// // //  * @returns The created or existing room ID, or null on error
// // //  */
// // // export async function startDm(client: MatrixClient, targets: Member[], showSpinner = true): Promise<string | null> {
// // //     const primaryTarget = targets[0].userId; // ✅ Always enforce single-user DM

// // //     // ✅ Reuse existing DM if found
// // //     const existingRoom: Optional<Room> = findDMForUser(client, primaryTarget);
// // //     if (existingRoom && !isLocalRoom(existingRoom)) {
// // //         dis.dispatch<ViewRoomPayload>({
// // //             action: Action.ViewRoom,
// // //             room_id: existingRoom.roomId,
// // //             should_peek: false,
// // //             joining: false,
// // //             metricsTrigger: "MessageUser",
// // //         });
// // //         return existingRoom.roomId;
// // //     }

// // //     const createRoomOptions: IOpts = {
// // //         inlineErrors: true,
// // //         dmUserId: primaryTarget,
// // //         spinner: showSpinner,
// // //         createOpts: {
// // //             invite: [primaryTarget], // ✅ Prevent multi-invite
// // //         },
// // //     };

// // //     // ✅ Add encryption if supported
// // //     if (await determineCreateRoomEncryptionOption(client, [targets[0]])) {
// // //         createRoomOptions.encryption = true;
// // //     }

// // //     return createRoom(client, createRoomOptions);
// // // }
// // import { MatrixClient } from "matrix-js-sdk/src/matrix";
// // import { logger } from "matrix-js-sdk/src/logger";
// // import { Member } from "../direct-messages";
// // import { determineCreateRoomEncryptionOption } from "../direct-messages";

// // export async function startDm(client: MatrixClient, targets: Member[], forceEncryption: boolean): Promise<string | null> {
// //     const userIds = targets.map(t => t.userId);

// //     let shouldEncrypt = forceEncryption;
// //     if (!forceEncryption) {
// //         shouldEncrypt = await determineCreateRoomEncryptionOption(client, targets);
// //     }

// //     const createOpts: any = {
// //         invite: userIds,
// //         is_direct: true,
// //         preset: "trusted_private_chat",
// //     };

// //     if (shouldEncrypt) {
// //         createOpts.initial_state = [{
// //             type: "m.room.encryption",
// //             state_key: "",
// //             content: { algorithm: "m.megolm.v1.aes-sha2" },
// //         }];
// //     }

// //     try {
// //         const { room_id } = await client.createRoom(createOpts);
// //         return room_id;
// //     } catch (err) {
// //         logger.error("Error creating DM room", err);
// //         return null;
// //     }
// // }
// import { MatrixClient } from "matrix-js-sdk/src/matrix";
// import { logger } from "matrix-js-sdk/src/logger";
// import { Member } from "../direct-messages";
// import { determineCreateRoomEncryptionOption } from "../direct-messages";

// export async function startDm(client: MatrixClient, targets: Member[], forceEncryption: boolean): Promise<string | null> {
//     const userIds = targets.map(t => t.userId);

//     let shouldEncrypt = forceEncryption;
//     if (!forceEncryption) {
//         shouldEncrypt = await determineCreateRoomEncryptionOption(client, targets);
//     }

//     const createOpts: any = {
//         invite: userIds,
//         is_direct: true,
//         preset: "trusted_private_chat",
//     };

//     if (shouldEncrypt) {
//         createOpts.initial_state = [{
//             type: "m.room.encryption",
//             state_key: "",
//             content: { algorithm: "m.megolm.v1.aes-sha2" },
//         }];
//     }

//     try {
//         const { room_id } = await client.createRoom(createOpts);
//         return room_id;
//     } catch (err) {
//         logger.error("Error creating DM room", err);
//         return null;
//     }
// }
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { Member } from "../direct-messages";
import { determineCreateRoomEncryptionOption } from "../direct-messages";

export async function startDm(client: MatrixClient, targets: Member[], forceEncryption: boolean): Promise<string | null> {
    const userIds = targets.map(t => t.userId);

    let shouldEncrypt = forceEncryption;
    if (!forceEncryption) {
        shouldEncrypt = await determineCreateRoomEncryptionOption(client, targets);
    }

    const createOpts: any = {
        invite: userIds,
        is_direct: true,
        preset: "trusted_private_chat",
    };

    if (shouldEncrypt) {
        createOpts.initial_state = [{
            type: "m.room.encryption",
            state_key: "",
            content: { algorithm: "m.megolm.v1.aes-sha2" },
        }];
    }

    try {
        const { room_id } = await client.createRoom(createOpts);
        return room_id;
    } catch (err) {
        logger.error("Error creating DM room", err);
        return null;
    }
}
