/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { getUserNameColorClass } from "../../../utils/FormattingUtils";
import UserIdentifier from "../../../customisations/UserIdentifier";

interface MemberInfo {
    userId: string;
    roomId: string;
    rawDisplayName?: string;
    disambiguate: boolean;
}

interface IProps {
    member?: MemberInfo | null;
    fallbackName: string;
    onClick?(): void;
    colored?: boolean;
    emphasizeDisplayName?: boolean;
    withTooltip?: boolean;
}

export default class DisambiguatedProfile extends React.Component<IProps> {
    // Helper function to clean display name if it contains user ID
    private cleanDisplayName(displayName: string, userId?: string): { cleaned: string; hadUserId: boolean } {
        if (!userId || !displayName) return { cleaned: displayName, hadUserId: false };
        
        // Check if display name already contains the user ID
        // Pattern: "Display Name @user:domain.com" or "Display Name user:domain.com"
        const userIdPattern = userId.replace(/^@/, ""); // Remove @ if present
        const userIdWithAt = `@${userIdPattern}`;
        
        // Remove user ID from display name if it's appended
        let cleaned = displayName;
        let hadUserId = false;
        
        // Check for pattern at the end: "name @user:domain" or "name user:domain"
        // Also check in the middle or beginning
        const escapedUserIdWithAt = userIdWithAt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedUserIdPattern = userIdPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Check if display name contains user ID with @
        if (cleaned.includes(userIdWithAt)) {
            hadUserId = true;
            // Remove from end first (most common case)
            cleaned = cleaned.replace(new RegExp(`\\s+${escapedUserIdWithAt}\\s*$`), "").trim();
            // Remove from middle or beginning
            cleaned = cleaned.replace(new RegExp(`\\s*${escapedUserIdWithAt}\\s+`), " ").trim();
            cleaned = cleaned.replace(new RegExp(`^${escapedUserIdWithAt}\\s+`), "").trim();
        } else if (cleaned.includes(userIdPattern)) {
            hadUserId = true;
            // Remove from end first (most common case)
            cleaned = cleaned.replace(new RegExp(`\\s+${escapedUserIdPattern}\\s*$`), "").trim();
            // Remove from middle or beginning
            cleaned = cleaned.replace(new RegExp(`\\s*${escapedUserIdPattern}\\s+`), " ").trim();
            cleaned = cleaned.replace(new RegExp(`^${escapedUserIdPattern}\\s+`), "").trim();
        }
        
        return { cleaned: cleaned || displayName, hadUserId }; // Return original if cleaned is empty
    }
    
    public render(): React.ReactNode {
        const { fallbackName, member, colored, emphasizeDisplayName, withTooltip, onClick } = this.props;
        const mxid = member?.userId;
        let rawDisplayName = member?.rawDisplayName || fallbackName;
        
        // Clean the display name if it contains the user ID
        const { cleaned: cleanedDisplayName, hadUserId } = this.cleanDisplayName(rawDisplayName, mxid);
        rawDisplayName = cleanedDisplayName;

        let colorClass: string | undefined;
        if (colored) {
            colorClass = getUserNameColorClass(mxid ?? "");
        }

        let mxidElement;
        let title: string | undefined;

        if (mxid) {
            const identifier =
                UserIdentifier.getDisplayUserIdentifier?.(mxid, {
                    withDisplayName: true,
                    roomId: member.roomId,
                }) ?? mxid;
            // Only show mxidElement if disambiguate is true AND the display name didn't already contain the user ID
            if (member?.disambiguate && !hadUserId) {
                mxidElement = <span className="mx_DisambiguatedProfile_mxid">{identifier}</span>;
            }
            title = _t("timeline|disambiguated_profile", {
                displayName: rawDisplayName,
                matrixId: identifier,
            });
        }

        const displayNameClasses = classNames(colorClass, {
            mx_DisambiguatedProfile_displayName: emphasizeDisplayName,
        });

        return (
            <div className="mx_DisambiguatedProfile" title={withTooltip ? title : undefined} onClick={onClick}>
                <span className={displayNameClasses} dir="auto">
                    {rawDisplayName}
                </span>
                {mxidElement}
            </div>
        );
    }
}
