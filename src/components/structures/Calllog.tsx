import React, { useEffect, useState } from "react";
import classNames from "classnames";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";
import VoiceCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/voice-call";

// Decrypt utility using Web Crypto API
async function getCryptoKey() {
    const base64Key = localStorage.getItem("mx_recovery_key");
    if (!base64Key) throw new Error("No recovery key found in localStorage");
    let rawKey;
    try {
        rawKey = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    } catch (e) {
        rawKey = new TextEncoder().encode(base64Key);
    }
    return await window.crypto.subtle.importKey(
        "raw",
        rawKey,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
}

async function decryptData({ iv, ciphertext }: { iv: string, ciphertext: string }) {
    const key = await getCryptoKey();
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    const ctBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBytes },
        key,
        ctBytes
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
}

export const Calllog = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [callLogs, setCallLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const toggle = () => setIsOpen(!isOpen);

    const fetchCallLogs = async () => {
        setLoading(true);
        setError("");
        try {
            const logs = JSON.parse(localStorage.getItem("mx_call_logs") || "[]");
            // Decrypt each log entry
            const decryptedLogs = await Promise.all(
                (logs || []).map(async (log: any) => {
                    try {
                        return await decryptData(log);
                    } catch (e) {
                        console.error("Failed to decrypt log:", e);
                        return null;
                    }
                })
            );
            setCallLogs(decryptedLogs.filter(Boolean));
        } catch (err: any) {
            setError("Failed to load call logs from localStorage");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchCallLogs();
        }
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
                        padding: "0px",
                        margin: "0px",
                        maxHeight: callLogs.length > 7 ? "350px" : undefined,
                        overflowY: callLogs.length > 7 ? "auto" : undefined,
                    }}
                >
                    {loading && <li>Loading...</li>}
                    {error && <li style={{ color: "red" }}>{error}</li>}
                    {!loading && !error && callLogs.length === 0 && <li>No call logs available.</li>}
                    {callLogs.map((log: any, idx: number) => {
                        const userName = log?.userName || `User ${idx + 1}`;
                        return (
                            <li key={idx} className="mx_RoomTile" style={{ gap: "12px" }}>
                                <div
                                    className="mx_RoomTile_avatar"
                                    style={{
                                        width: "38px",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        height: "35px",
                                    }}
                                >
                                    <img
                                        style={{ width: "100%", borderRadius: "50px" }}
                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                                            userName
                                        )}&background=007bff&color=fff`}
                                        alt={userName}
                                        className="avatar-img"
                                    />
                                </div>
                                <div
                                    className="mx_RoomTile_content"
                                    style={{
                                        width: "100%",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <div>{userName}</div>
                                    {/* <div className="call-type" style={{ display: "flex", gap: "7px" }}>
                                        <span
                                            className="call-icon audio"
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
                                            }}
                                        >
                                            <VoiceCallIcon style={{ fontSize: "20px", color: "#fff" }} />
                                        </span>
                                        <span
                                            className="call-icon video"
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
                                            }}
                                        >
                                            <VideoCallIcon style={{ fontSize: "20px", color: "#fff" }} />
                                        </span>
                                    </div> */}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};
