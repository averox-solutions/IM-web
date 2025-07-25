/*
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import React from "react";
import SettingsFieldset from "./SettingsFieldset";
import AccessibleButton from "../elements/AccessibleButton";

const TWO_FA_API_KEY = "cd61775633b58a3f6c630d7a15e335f6";

interface IState {
    // Reset 2FA
    reset2faLoading: boolean;
    reset2faResult: { secret: string; otpauth_url: string; qr: string; message: string } | null;
    reset2faError: string | null;

    // Toggle 2FA
    toggle2faLoading: boolean;
    toggle2faStatus: boolean | null; // true = enabled, false = disabled
    toggle2faError: string | null;
}

export default class SetIdServer extends React.Component<{}, IState> {
    constructor(props: {}) {
        super(props);
        this.state = {
            reset2faLoading: false,
            reset2faResult: null,
            reset2faError: null,

            toggle2faLoading: false,
            toggle2faStatus: null,
            toggle2faError: null,
        };
    }

    async componentDidMount(): Promise<void> {
        await this.fetch2FAStatus();
    }

    /** Fetch current 2FA status */
    private async fetch2FAStatus(): Promise<void> {
        try {
            const username = localStorage.getItem("mx_user_id");
            if (!username) return;

            const response = await fetch(`https://em4.averox.com/2fa/status/${encodeURIComponent(username)}`, {
                method: "GET",
                headers: {
                    "api-key": TWO_FA_API_KEY,
                    "Content-Type": "application/json",
                },
            });

            const result = await response.json();
            if (response.ok) {
                this.setState({ toggle2faStatus: result.isEnabled });
            } else {
                this.setState({ toggle2faError: result?.error || "Failed to fetch 2FA status" });
            }
        } catch (error: any) {
            this.setState({ toggle2faError: error.message || "Error fetching 2FA status" });
        }
    }

    /** Toggle 2FA enable/disable */
    private async toggle2FA(newState: boolean): Promise<void> {
        const username = localStorage.getItem("mx_user_id");
        if (!username) {
            this.setState({ toggle2faError: "Username not found in local storage" });
            return;
        }
    
        // Optimistically update state
        const previousState = this.state.toggle2faStatus;
        this.setState({ toggle2faStatus: newState, toggle2faLoading: true, toggle2faError: null });
    
        try {
            const response = await fetch("https://em4.averox.com/2fa/toggle", {
                method: "POST",
                headers: {
                    "api-key": TWO_FA_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, enabled: newState }),
            });
    
            const result = await response.json();
            if (!response.ok) throw new Error(result?.error || "Failed to toggle 2FA");
    
            this.setState({ toggle2faStatus: result.enabled, toggle2faLoading: false });
        } catch (err: any) {
            // Revert if API fails
            this.setState({
                toggle2faStatus: previousState,
                toggle2faError: err.message || "Failed to toggle 2FA",
                toggle2faLoading: false,
            });
        }
    }
    
    

    /** Reset 2FA secret */
    private async reset2FA(): Promise<void> {
        const username = localStorage.getItem("mx_user_id");
        if (!username) {
            this.setState({ reset2faError: "mx_user_id not found in localStorage" });
            return;
        }

        this.setState({ reset2faLoading: true, reset2faResult: null, reset2faError: null });

        try {
            const response = await fetch("https://em4.averox.com/2fa/delete", {
                method: "DELETE",
                headers: {
                    "api-key": TWO_FA_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username }),
            });

            if (!response.ok) throw new Error(`Failed to reset 2FA: ${response.statusText}`);

            const result = await response.json();
            this.setState({ reset2faResult: result, reset2faLoading: false });
        } catch (err: any) {
            this.setState({ reset2faError: err.message || String(err), reset2faLoading: false });
        }
    }

    render(): React.ReactNode {
        const {
            reset2faLoading,
            reset2faResult,
            reset2faError,
            toggle2faLoading,
            toggle2faStatus,
            toggle2faError,
        } = this.state;

        return (
            <SettingsFieldset legend="2FA Configurations" description="Manage your Two-Factor Authentication settings.">
                {/* 2FA Toggle Switch */}
                <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
                    <label style={{ marginRight: 10, fontWeight: 600 }}>Enable 2FA:</label>
                    <label style={{ position: "relative", display: "inline-block", width: 50, height: 24 }}>
                    <input
                            type="checkbox"
                            checked={!!toggle2faStatus}
                            disabled={toggle2faLoading || toggle2faStatus === null}
                            onChange={(e) => this.toggle2FA(e.target.checked)} // Pass the actual switch state
                            style={{ opacity: 0, width: 0, height: 0 }}
                        />

                        <span
                            style={{
                                position: "absolute",
                                cursor: toggle2faLoading ? "not-allowed" : "pointer",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: toggle2faStatus ? "#4caf50" : "#ccc",
                                transition: ".4s",
                                borderRadius: 24,
                            }}
                        >
                            <span
                                style={{
                                    position: "absolute",
                                    height: 18,
                                    width: 18,
                                    left: toggle2faStatus ? "26px" : "4px",
                                    bottom: "3px",
                                    backgroundColor: "white",
                                    transition: ".4s",
                                    borderRadius: "50%",
                                }}
                            ></span>
                        </span>
                    </label>
                </div>
                {toggle2faLoading && <div style={{ color: "#666", marginBottom: 8 }}>Updating...</div>}
                {toggle2faError && <div style={{ color: "red", marginBottom: 12 }}>{toggle2faError}</div>}
                <div style={{ marginBottom: 16 }}>
                    <strong>Status:</strong>{" "}
                    {toggle2faStatus === null ? "Loading..." : toggle2faStatus ? "Enabled" : "Disabled"}
                </div>

                {/* Reset 2FA */}
                <div style={{ marginBottom: 16 }}>
                    <AccessibleButton
                        kind="danger_sm"
                        onClick={() => this.reset2FA()}
                        disabled={reset2faLoading}
                    >
                        {reset2faLoading ? "Resetting..." : "Reset 2FA"}
                    </AccessibleButton>
                </div>
                {reset2faError && <div style={{ color: "red", marginBottom: 12 }}>{reset2faError}</div>}
                {reset2faResult && (
                    <div style={{ border: "1px solid #ccc", padding: 12, borderRadius: 4 }}>
                        <div><strong>Message:</strong> {reset2faResult.message}</div>
                        <div><strong>Secret:</strong> {reset2faResult.secret}</div>
                        <div><strong>otpauth URL:</strong> <code>{reset2faResult.otpauth_url}</code></div>
                        <div style={{ marginTop: 8 }}>
                            <strong>QR Code:</strong><br />
                            <img src={reset2faResult.qr} alt="2FA QR Code" style={{ maxWidth: 200, maxHeight: 200 }} />
                        </div>
                    </div>
                )}
            </SettingsFieldset>
        );
    }
}
