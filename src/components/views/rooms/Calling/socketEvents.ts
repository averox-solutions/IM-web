/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Connection events
export const CONNECT_SOCKET = "connect";
export const DISCONNECT_SOCKET = "disconnect";
export const CONNECT_ERROR = "connect_error";
export const ADD_USER = "ADD_USER";

// Call events
export const CREATE_ROOM = "create_room";
export const JOIN_ROOM = "join_room";
export const LEAVE_ROOM = "leave_room";
export const REJECT_CALL = "reject_call";
export const MISSED_CALL = "missed_call";
export const CALL_ACCEPTED = "call_accepted";
export const CALL_STATUS_UPDATE = "call_status_update";
export const BUSY_CALL = "busy_call";
export const INCOMING_CALL = "incoming_call";
export const CALL_ENDED = "call_ended";
export const CALL_DECLINED = "call_declined";
export const USER_LEFT_CALL = "user_left_call";

// Media events
export const NEW_PRODUCER = "new_producer";
export const PRODUCER_CLOSED = "producer_closed";
export const PEER_LEFT = "peer_left";
export const GET_PRODUCER = "get_producer";
export const CONSUME = "consume";
export const RESUME_CONSUMER = "resume_consumer";
export const CONNECT_TRANSPORT = "connect_transport";
export const PRODUCE = "produce";

// Message events
export const RECEIVE_MESSAGE = "RECEIVE_MESSAGE";
export const MESSAGE_STATUS_UPDATE = "MESSAGE_STATUS_UPDATE";
export const ACKNOWLEDGE_MESSAGES = "ACKNOWLEDGE_MESSAGES";

// Typing events
export const USER_TYPING = "USER_TYPING";
export const USER_STOPPED_TYPING = "USER_STOPPED_TYPING";
export const TYPING_STATUS_UPDATE = "TYPING_STATUS_UPDATE";

// Reaction events
export const REACTION_RECEIVED = "REACTION_RECEIVED";
export const REACTION_REMOVED = "REACTION_REMOVED";

// User status events
export const ONLINE_USERS_UPDATE = "ONLINE_USERS_UPDATE";

// Chat events
export const NEW_CHAT = "NEW_CHAT";
export const CREATE_GROUP = "CREATE_GROUP";

// Location events
export const RECEIVE_LOCATION = "RECEIVE_LOCATION";
