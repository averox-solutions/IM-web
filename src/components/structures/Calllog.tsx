/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from "react";
import classNames from "classnames";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";
import VoiceCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/voice-call";

export const Calllog = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggle = () => setIsOpen(!isOpen);

    return (
        <div className="mx_RoomSublist" style={{marginRight:"8px"}}>
            <div className="mx_RoomSublist_headerContainer" onClick={toggle}>
                <div className="mx_RoomSublist_headerText" style={{cursor:"pointer"}}>
                    <span
                        className={classNames("mx_RoomSublist_collapseBtn", {
                            mx_RoomSublist_collapseBtn_collapsed: !isOpen,
                        })}
                    />
                    <span className="mx_RoomSublist_headerTitle">Call logs</span>
                </div>
            </div>

            {isOpen && (
    <ul className="mx_CallLogList" style={{padding:"0px", margin:"0px"}}>
        {[1, 2, 3].map((log, idx) => {
            const userName = `User Name ${log}`;
            return (
                <li key={idx} className="mx_RoomTile" style={{gap:"12px"}}>
                    <div className="mx_RoomTile_avatar" style={{width:"38px",alignItems:"center",justifyContent:"center",height:"35px"}}>
                        <img style={{width:"100%",borderRadius:"50px"}}
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=007bff&color=fff`} 
                            alt={userName} 
                            className="avatar-img"
                        />
                    </div>
                    <div className="mx_RoomTile_content" style={{width:"100%", display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>{userName}</div>
                        <div className="call-type" style={{display:"flex",gap:"7px"}}>
                            <span className="call-icon audio"   
                            style={{
                            backgroundColor: "rgb(72, 141, 65)",
                            border: "none",
                            borderRadius: "50%",
                            width: "15px",
                            height: "15px",
                            padding: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background-color 0.2s ease, opacity 0.2s ease",
                        }}>
                        <VoiceCallIcon style={{ fontSize: "20px", color: "#fff" }} />
                        </span>

                            <span className="call-icon video"
                              style={{
                                backgroundColor: "rgb(72, 141, 65)",
                                border: "none",
                                borderRadius: "50%",
                                width: "15px",
                                height: "15px",
                                padding: "8px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "background-color 0.2s ease, opacity 0.2s ease",
                            }}>
                        <VideoCallIcon style={{ fontSize: "20px", color: "#fff" }} />
                            </span>
                        </div>
                    </div>
                </li>
            );
        })}
    </ul>
)}</div>
    );
};
