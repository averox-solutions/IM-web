/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MsgType } from "matrix-js-sdk/src/matrix";
import { type EncryptedFile, type RoomMessageEventContent } from "matrix-js-sdk/src/types";

/**
 * @param {string} mxc MXC URL of the file
 * @param {string} mimetype
 * @param {number} duration Duration in milliseconds
 * @param {number} size
 * @param {number[]} [waveform]
 * @param {EncryptedFile} [file] Encrypted file
 * @param {string} [codec] Audio codec (e.g., "aac", "opus")
 * @param {string} [container] Audio container format (e.g., "Apple MPEG-4 audio", "OGG")
 */
export const createVoiceMessageContent = (
    mxc: string | undefined,
    mimetype: string,
    duration: number,
    size: number,
    file?: EncryptedFile,
    waveform?: number[],
    codec?: string,
    container?: string,
): RoomMessageEventContent => {
    return {
        "body": "Voice message",
        //"msgtype": "org.matrix.msc2516.voice",
        "msgtype": MsgType.Audio,
        "url": mxc,
        "file": file,
        "info": {
            duration,
            mimetype,
            size,
        },

        // MSC1767 + Ideals of MSC2516 as MSC3245
        // https://github.com/matrix-org/matrix-doc/pull/3245
        "org.matrix.msc1767.text": "Voice message",
        "org.matrix.msc1767.file": {
            url: mxc,
            file,
            name: `recording${Date.now()}.wav`,
            mimetype,
            size,
        },
        "org.matrix.msc1767.audio": {
            duration,
            // https://github.com/matrix-org/matrix-doc/pull/3246
            waveform,
            ...(codec && { codec }),
            ...(container && { container }),
        },
        "org.matrix.msc3245.voice": {}, // No content, this is a rendering hint
    };
};
