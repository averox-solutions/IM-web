/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export enum InviteKind {
    Dm = "dm",
    Invite = "invite",
    // NB. This dialog needs the 'mx_InviteDialog_transferWrapper' wrapper class to have the correct
    // padding on the bottom (because all modals have 24px padding on all sides), so this needs to
    // be passed when creating the modal
    CallTransfer = "call_transfer",
}

/**
 * Utility functions to check the type of invite being performed
 */

/**
 * Returns true if the invite is for starting a Direct Message (1:1 chat or small group DM)
 */
export const isDirectMessageInvite = (kind: InviteKind): boolean => {
    return kind === InviteKind.Dm;
};

/**
 * Returns true if the invite is for inviting others to a room or space (group context)
 */
export const isGroupInvite = (kind: InviteKind): boolean => {
    return kind === InviteKind.Invite;
};

/**
 * Returns true if the invite is for transferring a call
 */
export const isCallTransferInvite = (kind: InviteKind): boolean => {
    return kind === InviteKind.CallTransfer;
};

/**
 * Returns true if the invite is for a group context (room or space)
 * This is an alias for isGroupInvite for better semantic clarity
 */
export const isRoomOrSpaceInvite = (kind: InviteKind): boolean => {
    return kind === InviteKind.Invite;
};
