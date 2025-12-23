/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export enum DefaultTagID {
    Invite = "im.vector.fake.invite",
    Untagged = "im.vector.fake.recent", // legacy: used to just be 'recent rooms' but now it's all untagged rooms
    Archived = "im.vector.fake.archived",
    LowPriority = "m.lowpriority",
    Favourite = "m.favourite",
    DM = "im.vector.fake.direct",
    Conference = "im.vector.fake.conferences",
    ServerNotice = "m.server_notice",
    Suggested = "im.vector.fake.suggested",
    Calllog="Call log",
    OneOnOneChatLeave = "1-1_chat_leave",
    OneOnOneLeftChat = "1-1_left_chat"
}

export const OrderedDefaultTagIDs = [
    DefaultTagID.Invite,
    DefaultTagID.Favourite,
    DefaultTagID.DM,
    DefaultTagID.Conference,
    DefaultTagID.Untagged,
    DefaultTagID.LowPriority,
    DefaultTagID.OneOnOneLeftChat,
    DefaultTagID.OneOnOneChatLeave,
    DefaultTagID.ServerNotice,
    DefaultTagID.Suggested,
    DefaultTagID.Archived,
    DefaultTagID.Calllog,
];

export type TagID = string | DefaultTagID;

export enum RoomUpdateCause {
    Timeline = "TIMELINE",
    PossibleTagChange = "POSSIBLE_TAG_CHANGE",
    PossibleMuteChange = "POSSIBLE_MUTE_CHANGE",
    ReadReceipt = "READ_RECEIPT",
    NewRoom = "NEW_ROOM",
    RoomRemoved = "ROOM_REMOVED",
}
