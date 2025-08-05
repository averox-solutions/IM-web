import React, { useEffect, useState } from "react";
import classNames from "classnames";
import CryptoJS from "crypto-js";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";
import VoiceCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/voice-call";

export const Calllog = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [callLogs, setCallLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const toggle = () => setIsOpen(!isOpen);

    // Utility: AES-CBC decryption
    const decryptValue = (encryptedBase64: string, key: CryptoJS.lib.WordArray, iv: CryptoJS.lib.WordArray): string => {
        try {
            const decrypted = CryptoJS.AES.decrypt(
                { ciphertext: CryptoJS.enc.Base64.parse(encryptedBase64) },
                key,
                {
                    iv,
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7,
                }
            );
            const result = decrypted.toString(CryptoJS.enc.Utf8);
            return result || "";
        } catch (e) {
            console.error("Decryption failed for:", encryptedBase64, e);
            return "";
        }
    };

    const decryptArray = (arr: string[], key: CryptoJS.lib.WordArray, iv: CryptoJS.lib.WordArray): string[] => {
        return arr.map(item => decryptValue(item, key, iv)).filter(Boolean);
    };

    const fetchCallLogs = async () => {
        setLoading(true);
        setError("");

        try {
            const headers = new Headers();
            headers.append("x-api-key", "dd567d9dc413ba272f5c418640a53c1ed89cce360b6e28af93f7c422dd0aaa16");

            const userId = localStorage.getItem("mx_user_id") || "";
            const rememberKey = localStorage.getItem("rememberKey") || "";

            const hash = CryptoJS.SHA256(rememberKey).toString(CryptoJS.enc.Hex);
            const shortHex = hash.slice(0, 32);
            const key = CryptoJS.enc.Hex.parse(shortHex);
            const iv = CryptoJS.enc.Hex.parse(shortHex);

            const response = await fetch(`https://beep.s.averox.com/api/call-logs/${encodeURIComponent(userId)}`, {
                method: "GET",
                headers,
            });

            if (!response.ok) throw new Error("HTTP error: " + response.status);
            const encryptedLogs = await response.json();

            const decryptedLogs = encryptedLogs.map((log: any) => {
                let hasError = false;

                const name = Array.isArray(log.name) ? decryptArray(log.name, key, iv) : [];
                const imageUrl = Array.isArray(log.imageUrl) ? decryptArray(log.imageUrl, key, iv) : [];

                const date = decryptValue(log.date, key, iv);
                const roomId = decryptValue(log.roomId, key, iv);
                const groupName = log.groupName ? decryptValue(log.groupName, key, iv) : "";
                const fromUserId = log.fromUserId ? decryptValue(log.fromUserId, key, iv) : "";
                const userCalledId = Array.isArray(log.userCalledId) ? decryptArray(log.userCalledId, key, iv) : [];

                if (!date || !roomId || (!groupName && !fromUserId && userCalledId.length === 0)) {
                    hasError = true;
                }

                return {
                    hasError,
                    userId: log.userId,
                    isVideoCall: log.isVideoCall,
                    isIncoming: log.isIncoming,
                    isMissedCall: log.isMissedCall,
                    isGroupCall: log.isGroupCall,
                    name,
                    imageUrl,
                    date,
                    roomId,
                    groupName,
                    fromUserId,
                    userCalledId,
                };
            });

            decryptedLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            setCallLogs(decryptedLogs.filter(Boolean));
        } catch (err) {
            console.error("Fetch error:", err);
            setError("Failed to fetch call logs.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchCallLogs();
    }, [isOpen]);

    return (
        <div className="mx_RoomSublist" style={{ marginRight: "8px" }}>
            <div className="mx_RoomSublist_headerContainer" onClick={toggle}>
                <div className="mx_RoomSublist_headerText" style={{ cursor: "pointer" }}>
                    <span
                        className={classNames("mx_RoomSublist_collapseBtn", {
                            mx_RoomSublist_collapseBtn_collapsed: !isOpen,
                        })}
                    />
                    <span className="mx_RoomSublist_headerTitle">Call logs</span>
                </div>
            </div>

            {isOpen && (
                <ul
                    className="mx_CallLogList"
                    style={{
                        padding: 0,
                        margin: 0,
                        maxHeight: callLogs.length > 7 ? "350px" : undefined,
                        overflowY: callLogs.length > 7 ? "auto" : undefined,
                    }}
                >
                    {loading && <li>Loading...</li>}
                    {error && <li style={{ color: "red" }}>{error}</li>}
                    {!loading && !error && callLogs.length === 0 && <li>No call logs available.</li>}

                    {callLogs.map((log, idx) => {
                        if (log.hasError) {
                            return (
                                <li key={idx} style={{ padding: "8px", fontStyle: "italic", color: "#888" }}>
                                    Unable to decrypt call log
                                </li>
                            );
                        }

                        const { isGroupCall, isVideoCall, isMissedCall, isIncoming } = log;

                        let displayName = "";
                        if (isGroupCall) {
                            displayName = log.groupName || "Group Call";
                        } else if (isIncoming) {
                            displayName = log.fromUserId || log.name?.[0] || "";
                        } else {
                            displayName = log.userCalledId?.[0] || "";
                        }

                        const callTypeLabel = isVideoCall ? "Video" : "Voice";
                        const directionLabel = isIncoming ? "Incoming" : "Outgoing";

                        return (
                            <li key={idx} className="mx_RoomTile" style={{ gap: "12px" }}>
                                <div
                                    className="mx_RoomTile_avatar"
                                    style={{
                                        width: "38px",
                                        height: "35px",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <img
                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=007bff&color=fff`}
                                        alt={displayName}
                                        style={{ width: "100%", borderRadius: "50px" }}
                                    />
                                </div>
                                <div
                                    className="mx_RoomTile_content"
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        width: "100%",
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{displayName}</div>
                                        <div style={{ fontSize: "12px", color: isMissedCall ? "#d9534f" : "#888" }}>
                                            {isGroupCall && (
                                                <span style={{ marginRight: 8, color: "#488d41" }}>Group Call</span>
                                            )}
                                            {isMissedCall && (
                                                <span
                                                    style={{
                                                        marginRight: 8,
                                                        color: "#d9534f",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    Missed
                                                </span>
                                            )}
                                            <span>{directionLabel}</span>
                                            <span style={{ marginLeft: 8 }}>{callTypeLabel}</span>
                                        </div>
                                    </div>
                                    <div className="call-type" style={{ display: "flex", gap: "7px" }}>
                                        <span
                                            style={{
                                                backgroundColor: isMissedCall ? "#d9534f" : "rgb(72, 141, 65)",
                                                borderRadius: "50%",
                                                width: "35px",
                                                height: "35px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            {isVideoCall ? (
                                                <VideoCallIcon style={{ fontSize: "20px", color: "#fff" }} />
                                            ) : (
                                                <VoiceCallIcon style={{ fontSize: "20px", color: "#fff" }} />
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};
