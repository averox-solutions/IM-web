import React, { useEffect, useState } from "react";
import classNames from "classnames";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";
import VoiceCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/voice-call";

// --- AES-CBC Decryption Logic ---
async function deriveCBCKeyAndIV(userKey: string): Promise<{ key: CryptoKey, iv: Uint8Array }> {
    const encoder = new TextEncoder();
    const keyMaterial = encoder.encode(userKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", keyMaterial);
    const hashArray = new Uint8Array(hashBuffer);
    const sliced = hashArray.slice(0, 16); // 16 bytes for AES-128
    const key = await crypto.subtle.importKey("raw", sliced, { name: "AES-CBC" }, false, ["decrypt"]);
    return { key, iv: sliced };
}

async function decryptCallLogFieldCBC(encryptedBase64: string, userKey: string): Promise<string> {
    try {
        const { key, iv } = await deriveCBCKeyAndIV(userKey);
        const encryptedBytes = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, encryptedBytes);
        return new TextDecoder().decode(decryptedBuffer).trim();
    } catch (e) {
        console.error("Decryption failed for field:", encryptedBase64, e);
        return "";
    }
}

async function decryptCallLogArrayCBC(array: string[], userKey: string): Promise<string[]> {
    return Promise.all(array.map(item => decryptCallLogFieldCBC(item, userKey)));
}

async function decryptCallLogEntry(entry: any, userKey: string): Promise<any> {
    const decryptedEntry: any = {};
    for (const key in entry) {
        const value = entry[key];
        if (key === "userId" || key === "_id") {
            decryptedEntry[key] = value;
        } else if (Array.isArray(value)) {
            decryptedEntry[key] = await decryptCallLogArrayCBC(value, userKey);
        } else if (typeof value === "string") {
            decryptedEntry[key] = await decryptCallLogFieldCBC(value, userKey);
        } else {
            decryptedEntry[key] = value;
        }
    }
    return decryptedEntry;
}

// --- Main Component ---
export const Calllog = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [callLogs, setCallLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const toggle = () => setIsOpen(!isOpen);

    const fetchCallLogs = async () => {
        setLoading(true);
        setError("");

        const userKey = localStorage.getItem("mx_recovery_key") || "";
        if (!userKey) {
            setError("Encryption key missing (mx_recovery_key not found).");
            setLoading(false);
            return;
        }

        try {
            const rawLogs = JSON.parse(localStorage.getItem("mx_call_logs") || "[]");
            const decryptedLogs = await Promise.all(
                rawLogs.map(async (entry: any) => {
                    try {
                        return await decryptCallLogEntry(entry, userKey);
                    } catch (e) {
                        console.error("Error decrypting entry:", e);
                        return null;
                    }
                })
            );
            setCallLogs(decryptedLogs.filter(Boolean));
        } catch (err) {
            console.error("Failed to load call logs:", err);
            setError("Failed to load call logs.");
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
                    <span className={classNames("mx_RoomSublist_collapseBtn", {
                        mx_RoomSublist_collapseBtn_collapsed: !isOpen,
                    })} />
                    <span className="mx_RoomSublist_headerTitle">Call logs</span>
                </div>
            </div>

            {isOpen && (
                <ul className="mx_CallLogList" style={{
                    padding: 0,
                    margin: 0,
                    maxHeight: callLogs.length > 7 ? "350px" : undefined,
                    overflowY: callLogs.length > 7 ? "auto" : undefined,
                }}>
                    {loading && <li>Loading...</li>}
                    {error && <li style={{ color: "red" }}>{error}</li>}
                    {!loading && !error && callLogs.length === 0 && <li>No call logs available.</li>}

                    {callLogs.map((log, idx) => {
                        const userName = log?.name?.[0]?.trim() || `User ${idx + 1}`;
                        const isVideoCall = log?.isVideoCall;

                        return (
                            <li key={idx} className="mx_RoomTile" style={{ gap: "12px" }}>
                                <div className="mx_RoomTile_avatar" style={{
                                    width: "38px",
                                    height: "35px",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                    <img
                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=007bff&color=fff`}
                                        alt={userName}
                                        style={{ width: "100%", borderRadius: "50px" }}
                                    />
                                </div>
                                <div className="mx_RoomTile_content" style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    width: "100%",
                                }}>
                                    <div>{userName}</div>
                                    <div className="call-type" style={{ display: "flex", gap: "7px" }}>
                                        <span style={{
                                            backgroundColor: "rgb(72, 141, 65)",
                                            borderRadius: "50%",
                                            width: "15px",
                                            height: "15px",
                                            padding: "8px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}>
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
