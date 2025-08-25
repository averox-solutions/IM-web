/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import * as React from "react";
import { useContext, useState } from "react";

import AutoHideScrollbar from "./AutoHideScrollbar";
import { getHomePageUrl } from "../../utils/pages";
import { _tDom } from "../../languageHandler";
import SdkConfig from "../../SdkConfig";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import BaseAvatar from "../views/avatars/BaseAvatar";
import { OwnProfileStore } from "../../stores/OwnProfileStore";
import AccessibleButton, { type ButtonEvent } from "../views/elements/AccessibleButton";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import { useEventEmitter } from "../../hooks/useEventEmitter";
import MatrixClientContext, { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import MiniAvatarUploader, { AVATAR_SIZE } from "../views/elements/MiniAvatarUploader";
import PosthogTrackers from "../../PosthogTrackers";
import EmbeddedPage from "./EmbeddedPage";

// Button click handlers
const onClickSendDm = (ev: ButtonEvent) => {
    PosthogTrackers.trackInteraction("WebHomeCreateChatButton", ev);
    dis.dispatch({ action: "view_create_chat" });
};
const onClickExplore = (ev: ButtonEvent) => {
    PosthogTrackers.trackInteraction("WebHomeExploreRoomsButton", ev);
    dis.fire(Action.ViewRoomDirectory);
};
const onClickNewRoom = (ev: ButtonEvent) => {
    PosthogTrackers.trackInteraction("WebHomeCreateRoomButton", ev);
    dis.dispatch({ action: "view_create_room" });
};

// Fetch user's avatar
const getOwnProfile = (userId: string) => ({
    displayName: OwnProfileStore.instance.displayName || userId,
    avatarUrl: OwnProfileStore.instance.getHttpAvatarUrl(parseInt(AVATAR_SIZE, 10)) ?? undefined,
});

const UserWelcomeTop: React.FC = () => {
    const cli = useContext(MatrixClientContext);
    const userId = cli.getUserId()!;
    const [ownProfile, setOwnProfile] = useState(getOwnProfile(userId));
    useEventEmitter(OwnProfileStore.instance, UPDATE_EVENT, () => {
        setOwnProfile(getOwnProfile(userId));
    });

    return (
        <div style={{ textAlign: "center" }}>
            <MiniAvatarUploader
                hasAvatar={!!ownProfile.avatarUrl}
                hasAvatarLabel={_tDom("onboarding|has_avatar_label")}
                noAvatarLabel={_tDom("onboarding|no_avatar_label")}
                setAvatarUrl={(url) => cli.setAvatarUrl(url)}
                isUserAvatar
            >
                <BaseAvatar
                    idName={userId}
                    name={ownProfile.displayName}
                    url={ownProfile.avatarUrl}
                    size={AVATAR_SIZE}
                />
            </MiniAvatarUploader>
            <h1>{_tDom("onboarding|welcome_user", { name: ownProfile.displayName })}</h1>
            <h2>{_tDom("onboarding|welcome_detail")}</h2>
        </div>
    );
};

interface IProps {
    justRegistered?: boolean;
}

const HomePage: React.FC<IProps> = ({ justRegistered = false }) => {
    const cli = useMatrixClientContext();
    const config = SdkConfig.get();
    const pageUrl = getHomePageUrl(config, cli);

    const brandingConfig = SdkConfig.getObject("branding");
    const logoUrl = brandingConfig?.get("auth_header_logo_url") ?? "themes/element/img/logos/element-logo--.png";

    if (pageUrl) return <EmbeddedPage className="mx_HomePage" url={pageUrl} scrollbar />;

    const [showTooltip, setShowTooltip] = useState(false);

    let introSection: JSX.Element;
    if (justRegistered || !OwnProfileStore.instance.getHttpAvatarUrl(parseInt(AVATAR_SIZE, 10))) {
        introSection = <UserWelcomeTop />;
    } else {
        introSection = (
            <>
                <h1>{_tDom("onboarding|intro_welcome", { appName: config.brand })}</h1>
                <h2>{_tDom("onboarding|intro_byline")}</h2>
            </>
        );
    }

    return (
        <AutoHideScrollbar className="mx_HomePage mx_HomePage_default" element="main">
            <div className="mx_HomePage_default_wrapper">
                {introSection}

                {/* Logo with Tooltip on Hover or Click */}
                <div
                    style={{
                        position: "relative",
                        textAlign: "center",
                        marginTop: "17px",
                    }}
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                >
                    <img
                        src={logoUrl}
                        alt={config.brand}
                        style={{
                            width: "400px",
                            height: "350px",
                            cursor: "pointer",
                            transition: "transform 0.3s ease-in-out",
                            marginBottom: "10px",
                        }}
                    />

                    {/* Tooltips positioned on the left and right */}
                    {showTooltip && (
                        <div
                            style={{
                                position: "absolute",
                                left: "-220px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "rgba(158,189,234,0.42)",
                                color: "#616161",
                                padding: "10px",
                                borderRadius: "8px",
                                width: "200px",
                                textAlign: "left",
                                boxShadow: "0 4px 6px rgba(5,100,244,0.63)",
                            }}
                        >
                            <ul>
                            <li>Click "Send Message" and add the user ID to start a one-on-one chat.</li>
                            <li>Click "Explore Group" to search and join chats, groups, or rooms.</li>
                            </ul>
                        </div>
                    )}

                    {showTooltip && (
                        <div
                            style={{
                                position: "absolute",
                                right: "-220px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "rgba(158,189,234,0.42)",
                                color: "#616161",
                                padding: "10px",
                                borderRadius: "8px",
                                width: "200px",
                                textAlign: "left",
                                boxShadow: "0 4px 6px rgba(5,100,244,0.63)",
                            }}
                        >
                            <ul>
                            <li>Click "Group Chat" to create a group chat and invite users.</li>
                            <li>Click "Create" select "Video Group" to start a video chat.</li>
                            </ul>
                        </div>
                    )}

                    {/* Bottom Tooltip showing the buttons */}
                    {showTooltip && (
                        <div
                            style={{
                                position: "absolute",
                                bottom: "-59px", // Adjust this based on the image size
                                left: "50%",
                                transform: "translateX(-50%)",
                                display: "flex",
                                gap: "10px",
                            }}
                        >
                            <AccessibleButton onClick={onClickSendDm} className="mx_HomePage_button_sendDm">
                                {_tDom("onboarding|send_dm")}
                            </AccessibleButton>
                            <AccessibleButton onClick={onClickExplore} className="mx_HomePage_button_explore">
                                {_tDom("onboarding|explore_rooms")}
                            </AccessibleButton>
                            <AccessibleButton onClick={onClickNewRoom} className="mx_HomePage_button_createGroup">
                                {_tDom("onboarding|create_room")}
                            </AccessibleButton>
                        </div>
                    )}
                </div>
            </div>
        </AutoHideScrollbar>
    );
};

export default HomePage;


