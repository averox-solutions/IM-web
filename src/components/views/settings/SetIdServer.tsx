// /*
// SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
// */

// import React from "react";
// import SettingsFieldset from "./SettingsFieldset";
// import AccessibleButton from "../elements/AccessibleButton";

// const TWO_FA_API_KEY = "cd61775633b58a3f6c630d7a15e335f6";

// interface Reset2FAResult {
//     secret: string;
//     otpauth_url: string;
//     qr: string;
//     message: string;
// }

// interface IState {
//     // Setup / Reset 2FA
//     reset2faLoading: boolean;
//     reset2faResult: Reset2FAResult | null;
//     reset2faError: string | null;

//     // Toggle 2FA
//     toggle2faLoading: boolean;
//     toggle2faStatus: boolean | null;
//     toggle2faError: string | null;

//     // OTP Verification
//     otpCode: string;
//     otpVerifying: boolean;
//     otpError: string | null;

//     // Status flags
//     isConfigured: boolean;
// }

// export default class SetIdServer extends React.Component<{}, IState> {
//     constructor(props: {}) {
//         super(props);
//         this.state = {
//             reset2faLoading: false,
//             reset2faResult: null,
//             reset2faError: null,

//             toggle2faLoading: false,
//             toggle2faStatus: null,
//             toggle2faError: null,

//             otpCode: "",
//             otpVerifying: false,
//             otpError: null,

//             isConfigured: false,
//         };
//     }

//     async componentDidMount(): Promise<void> {
//         await this.fetch2FAStatus();
//     }

//     /** Fetch current 2FA status */
//     private async fetch2FAStatus(): Promise<void> {
//         try {
//             const username = localStorage.getItem("mx_user_id");
//             if (!username) return;

//             const response = await fetch(`https://em4.averox.com/2fa/status/${encodeURIComponent(username)}`, {
//                 method: "GET",
//                 headers: {
//                     "api-key": TWO_FA_API_KEY,
//                     "Content-Type": "application/json",
//                 },
//             });

//             const result = await response.json();

//             if (response.ok) {
//                 this.setState({
//                     toggle2faStatus: result.isEnabled,
//                     isConfigured: result.isConfigured,
//                     toggle2faError: null,
//                 });
//             } else {
//                 this.setState({ toggle2faError: result?.error || "Failed to fetch 2FA status" });
//             }
//         } catch (error: any) {
//             this.setState({ toggle2faError: error.message || "Error fetching 2FA status" });
//         }
//     }

//     /** Generate new 2FA secret and QR code (only for first-time setup) */
//     private async generate2FASecret(): Promise<void> {
//         const username = localStorage.getItem("mx_user_id");
//         if (!username) {
//             this.setState({ reset2faError: "mx_user_id not found in localStorage" });
//             return;
//         }

//         this.setState({ reset2faLoading: true, reset2faResult: null, reset2faError: null });

//         try {
//             const response = await fetch("https://em4.averox.com/2fa/generate", {
//                 method: "POST",
//                 headers: {
//                     "api-key": TWO_FA_API_KEY,
//                     "Content-Type": "application/json",
//                 },
//                 body: JSON.stringify({ username }),
//             });

//             if (!response.ok) throw new Error(`Failed to generate 2FA secret`);

//             const result = await response.json();
//             this.setState({ reset2faResult: result, reset2faLoading: false });
//         } catch (err: any) {
//             this.setState({ reset2faError: err.message || String(err), reset2faLoading: false });
//         }
//     }

//     /** Verify OTP before enabling 2FA */
//     private async verifyOTP(): Promise<void> {
//         const username = localStorage.getItem("mx_user_id");
//         const { otpCode } = this.state;
//         if (!username || !otpCode) {
//             this.setState({ otpError: "Please enter the OTP code." });
//             return;
//         }

//         this.setState({ otpVerifying: true, otpError: null });

//         try {
//             const response = await fetch("https://em4.averox.com/2fa/verify", {
//                 method: "POST",
//                 headers: {
//                     "api-key": TWO_FA_API_KEY,
//                     "Content-Type": "application/json",
//                 },
//                 body: JSON.stringify({ username, token: otpCode }),
//             });

//             const result = await response.json();
//             if (!response.ok) throw new Error(result?.error || "Invalid OTP");

//             // OTP verified → enable 2FA
//             await this.toggle2FA(true);
//             this.setState({ otpVerifying: false, otpCode: "", reset2faResult: null, isConfigured: true });
//         } catch (err: any) {
//             this.setState({ otpError: err.message || "OTP verification failed", otpVerifying: false });
//         }
//     }

//     /** Toggle 2FA enable/disable */
//     private async toggle2FA(newState: boolean): Promise<void> {
//         const username = localStorage.getItem("mx_user_id");
//         if (!username) {
//             this.setState({ toggle2faError: "Username not found in local storage" });
//             return;
//         }

//         this.setState({ toggle2faLoading: true, toggle2faError: null });

//         try {
//             const response = await fetch("https://em4.averox.com/2fa/toggle", {
//                 method: "POST",
//                 headers: {
//                     "api-key": TWO_FA_API_KEY,
//                     "Content-Type": "application/json",
//                 },
//                 body: JSON.stringify({ username, enabled: newState }),
//             });

//             const result = await response.json();
//             if (!response.ok) throw new Error(result?.error || "Failed to toggle 2FA");

//             this.setState({
//                 toggle2faStatus: result.isEnabled,
//                 toggle2faLoading: false,
//                 toggle2faError: null,
//             });
//         } catch (err: any) {
//             this.setState({
//                 toggle2faError: err.message || "Failed to toggle 2FA",
//                 toggle2faLoading: false,
//             });
//         }
//     }

//     render(): React.ReactNode {
//         const {
//             reset2faLoading,
//             reset2faResult,
//             reset2faError,
//             toggle2faLoading,
//             toggle2faStatus,
//             toggle2faError,
//             otpCode,
//             otpVerifying,
//             otpError,
//             isConfigured,
//         } = this.state;

//         return (
//             <SettingsFieldset legend="2FA Configurations" description="Manage your Two-Factor Authentication settings.">
//                 {/* 2FA Toggle */}
//                 <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
//                     <label style={{ marginRight: 10, fontWeight: 600 }}>Enable 2FA:</label>
//                     <input
//                         type="checkbox"
//                         checked={!!toggle2faStatus}
//                         disabled={toggle2faLoading || toggle2faStatus === null}
//                         onChange={async (e) => {
//                             const newState = e.target.checked;
//                             if (newState) {
//                                 if (isConfigured) {
//                                     await this.toggle2FA(true);
//                                 } else {
//                                     await this.generate2FASecret();
//                                 }
//                             } else {
//                                 await this.toggle2FA(false);
//                             }
//                         }}
//                     />
//                 </div>
//                 {toggle2faLoading && <div style={{ color: "#666", marginBottom: 8 }}>Updating...</div>}
//                 {toggle2faError && <div style={{ color: "red", marginBottom: 12 }}>{toggle2faError}</div>}
//                 <div style={{ marginBottom: 16 }}>
//                     <strong>Status:</strong>{" "}
//                     {toggle2faStatus === null ? "Loading..." : toggle2faStatus ? "Enabled" : "Disabled"}
//                 </div>

//                 {/* Setup UI if QR is generated */}
//                 {reset2faResult && (
//                     <div style={{ border: "1px solid #ccc", padding: 12, borderRadius: 4, marginBottom: 16 }}>
//                         <h4>Setup Two-Factor Authentication</h4>
//                         <div><strong>Secret:</strong> {reset2faResult.secret}</div>
//                         <div><strong>otpauth URL:</strong> <code>{reset2faResult.otpauth_url}</code></div>
//                         <div style={{ marginTop: 8 }}>
//                             <strong>QR Code:</strong><br />
//                             <img src={reset2faResult.qr} alt="2FA QR Code" style={{ maxWidth: 200, maxHeight: 200 }} />
//                         </div>

//                         <div style={{ marginTop: 12 }}>
//                             <label>Enter OTP:</label>
//                             <input
//                                 type="text"
//                                 value={otpCode}
//                                 onChange={(e) => this.setState({ otpCode: e.target.value })}
//                                 style={{ marginLeft: 8 }}
//                             />
//                             <AccessibleButton
//                                 kind="primary"
//                                 onClick={() => this.verifyOTP()}
//                                 disabled={otpVerifying || !otpCode}
//                                 style={{ marginLeft: 8 }}
//                             >
//                                 {otpVerifying ? "Verifying..." : "Verify & Enable"}
//                             </AccessibleButton>
//                             {otpError && <div style={{ color: "red", marginTop: 8 }}>{otpError}</div>}
//                         </div>
//                     </div>
//                 )}

//                 {/* Reset 2FA */}
//                 <div style={{ marginBottom: 16 }}>
//                     <AccessibleButton
//                         kind="danger_sm"
//                         onClick={() => this.generate2FASecret()}
//                         disabled={reset2faLoading}
//                     >
//                         {reset2faLoading ? "Resetting..." : "Reset 2FA"}
//                     </AccessibleButton>
//                 </div>
//                 {reset2faError && <div style={{ color: "red", marginBottom: 12 }}>{reset2faError}</div>}
//             </SettingsFieldset>
//         );
//     }
// }
/*
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import React from "react";
import SettingsFieldset from "./SettingsFieldset";
import AccessibleButton from "../elements/AccessibleButton";

// Read from process.env directly so webpack DefinePlugin can inline values at build time
const TWO_FA_API_KEY = process.env.REACT_APP_2FA_API_KEY;
const TWO_FA_BASE_URL = process.env.REACT_APP_2FA_URL;

function ensure2FAConfig(): { baseUrl: string; apiKey: string } | null {
    if (!TWO_FA_BASE_URL || !TWO_FA_API_KEY) return null;
    return { baseUrl: TWO_FA_BASE_URL, apiKey: TWO_FA_API_KEY };
}

interface IState {
    toggle2faLoading: boolean;
    toggle2faStatus: boolean | null;
    toggle2faError: string | null;

    reset2faLoading: boolean;
    reset2faError: string | null;

    isConfigured: boolean;
}

export default class SetIdServer extends React.Component<{}, IState> {
    constructor(props: {}) {
        super(props);
        this.state = {
            toggle2faLoading: false,
            toggle2faStatus: null,
            toggle2faError: null,

            reset2faLoading: false,
            reset2faError: null,

            isConfigured: false,
        };
    }

    async componentDidMount(): Promise<void> {
        await this.fetch2FAStatus();
    }

    /** Fetch 2FA Status */
    private async fetch2FAStatus(): Promise<void> {
        try {
            const username = localStorage.getItem("mx_user_id");
            if (!username) return;

            const cfg = ensure2FAConfig();
            if (!cfg) {
                this.setState({ toggle2faError: "2FA service is not configured. Please contact your administrator." });
                return;
            }
            const response = await fetch(`${cfg.baseUrl}/2fa/status/${encodeURIComponent(username)}`, {
                method: "GET",
                headers: {
                    "api-key": cfg.apiKey,
                    "Content-Type": "application/json",
                },
            });

            const result = await response.json();

            if (response.ok) {
                this.setState({
                    toggle2faStatus: result.isEnabled,
                    isConfigured: result.isConfigured,
                    toggle2faError: null,
                });
            } else {
                this.setState({ toggle2faError: result?.error || "Failed to fetch 2FA status" });
            }
        } catch (error: any) {
            this.setState({ toggle2faError: error.message || "Error fetching 2FA status" });
        }
    }

    /** Toggle 2FA */
    // private async toggle2FA(newState: boolean): Promise<void> {
    //     const username = localStorage.getItem("mx_user_id");
    //     if (!username) {
    //         this.setState({ toggle2faError: "Username not found in local storage" });
    //         return;
    //     }

    //     this.setState({ toggle2faLoading: true, toggle2faError: null });

    //     try {
    //         const cfg = ensure2FAConfig();
    //         if (!cfg) {
    //             this.setState({ toggle2faError: "2FA service is not configured. Please contact your administrator." });
    //             return;
    //         }
    //         const response = await fetch(`${cfg.baseUrl}/2fa/toggle`, {
    //             method: "POST",
    //             headers: {
    //                 "api-key": cfg.apiKey,
    //                 "Content-Type": "application/json",
    //             },
    //             body: JSON.stringify({ username, enabled: newState }),
    //         });

    //         const text = await response.text();
    //         let result: any = {};
    //         try {
    //             result = text ? JSON.parse(text) : {};
    //         } catch {
    //             // keep result as {}
    //         }

    //         // Treat idempotent backend responses as success
    //         const message = String(result?.message || "").toLowerCase();
    //         const isIdempotentEnable = newState && message.includes("already enabled");
    //         const isIdempotentDisable = !newState && message.includes("already disabled");

    //         if (!response.ok && !isIdempotentEnable && !isIdempotentDisable) {
    //             throw new Error(result?.error || result?.message || "Failed to toggle 2FA");
    //         }

    //         // Sync UI state: prefer payload's isEnabled, otherwise fall back to requested newState
    //         const effectiveEnabled = typeof result?.isEnabled === "boolean" ? result.isEnabled : newState;
    //         this.setState({
    //             toggle2faStatus: effectiveEnabled,
    //             toggle2faLoading: false,
    //             toggle2faError: null,
    //         });

    //         // Best-effort refresh to ensure server truth
    //         void this.fetch2FAStatus();
    //     } catch (err: any) {
    //         this.setState({
    //             toggle2faError: err.message || "Failed to toggle 2FA",
    //             toggle2faLoading: false,
    //         });
    //     }
    // }


    /** Toggle 2FA enable/disable */
    private async toggle2FA(newState: boolean): Promise<void> {
        const username = localStorage.getItem("mx_user_id");
        if (!username) {
            this.setState({ toggle2faError: "Username not found in local storage" });
            return;
        }

        // Once enabled, prevent disabling
        if (newState === false && this.state.toggle2faStatus === true) {
            this.setState({ toggle2faError: "Disabling 2FA is not permitted." });
            return;
        }

        this.setState({ toggle2faLoading: true, toggle2faError: null });

        try {
            const cfg = ensure2FAConfig();
            if (!cfg) {
                this.setState({ toggle2faError: "2FA service is not configured. Please contact your administrator." });
                return;
            }
            const response = await fetch(`${cfg.baseUrl}/2fa/toggle`, {
                method: "POST",
                headers: {
                    "api-key": cfg.apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, enabled: newState }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result?.error || "Failed to toggle 2FA");

            this.setState({
                toggle2faStatus: result.isEnabled,
                toggle2faLoading: false,
                toggle2faError: null,
            });
        } catch (err: any) {
            this.setState({
                toggle2faError: err.message || "Failed to toggle 2FA",
                toggle2faLoading: false,
            });
        }
    }

    /** Reset 2FA */
    private async reset2FA(): Promise<void> {
        const username = localStorage.getItem("mx_user_id");
        if (!username) {
            this.setState({ reset2faError: "Username not found in local storage" });
            return;
        }

        this.setState({ reset2faLoading: true, reset2faError: null });

        try {
            const cfg = ensure2FAConfig();
            if (!cfg) {
                this.setState({ reset2faError: "2FA service is not configured. Please contact your administrator." });
                return;
            }
            const response = await fetch(`${cfg.baseUrl}/2fa/reset`, {
                method: "POST",
                headers: {
                    "api-key": cfg.apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result?.error || "Failed to reset 2FA");

            this.setState({
                reset2faLoading: false,
                reset2faError: null,
                toggle2faStatus: false,
                isConfigured: false,
            });
        } catch (err: any) {
            this.setState({
                reset2faError: err.message || "Failed to reset 2FA",
                reset2faLoading: false,
            });
        }
    }

    render(): React.ReactNode {
        const {
            toggle2faLoading,
            toggle2faStatus,
            toggle2faError,
            reset2faLoading,
            reset2faError,
        } = this.state;

        return (
            <SettingsFieldset legend="2FA Configurations" description="Manage your Two-Factor Authentication settings.">
                {/* Toggle 2FA with Modern Switch */}
                <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
                    <label style={{ marginRight: 15, fontWeight: 600 }}>Enable 2FA:</label>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={!!toggle2faStatus}
                        disabled={toggle2faLoading || toggle2faStatus === null || toggle2faStatus === true}
                            onChange={async (e) => {
                                const newState = e.target.checked;
                                await this.toggle2FA(newState);
                            }}
                        />
                        <span className="slider round"></span>
                    </label>
                </div>
                {toggle2faLoading && <div style={{ color: "#666", marginBottom: 8 }}>Updating...</div>}
                {toggle2faError && <div style={{ color: "red", marginBottom: 12 }}>{toggle2faError}</div>}
                <div style={{ marginBottom: 16 }}>
                    <strong>Status:</strong>{" "}
                    {toggle2faStatus === null ? "Loading..." : toggle2faStatus ? "Enabled" : "Disabled"}
                </div>

                {/* Reset 2FA */}
                {/* <div style={{ marginBottom: 16 }}>
                    <AccessibleButton
                        kind="danger_sm"
                        onClick={() => this.reset2FA()}
                        disabled={reset2faLoading}
                    >
                        {reset2faLoading ? "Resetting..." : "Reset 2FA"}
                    </AccessibleButton>
                </div> */}
                {reset2faError && <div style={{ color: "red", marginBottom: 12 }}>{reset2faError}</div>}

                {/* Switch CSS */}
                <style>
                    {`
                        .switch {
                            position: relative;
                            display: inline-block;
                            width: 50px;
                            height: 28px;
                        }
                        .switch input {
                            opacity: 0;
                            width: 0;
                            height: 0;
                        }
                        .slider {
                            position: absolute;
                            cursor: pointer;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background-color: #ccc;
                            transition: .4s;
                            border-radius: 34px;
                        }
                        .slider:before {
                            position: absolute;
                            content: "";
                            height: 22px;
                            width: 22px;
                            left: 3px;
                            bottom: 3px;
                            background-color: white;
                            transition: .4s;
                            border-radius: 50%;
                        }
                        input:checked + .slider {
                            background-color: #4CAF50;
                        }
                        input:checked + .slider:before {
                            transform: translateX(22px);
                        }
                        .slider.round {
                            border-radius: 34px;
                        }
                    `}
                </style>
            </SettingsFieldset>
        );
    }
}