/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";

export default class Welcome extends React.PureComponent<EmptyObject> {
    public componentDidMount(): void {
        // Let the app use the config.json server configuration
        // Remove hardcoded redirect to allow proper server configuration
        // Auto-click the Sign In button
        setTimeout(() => {
            document.getElementById("auto-signin-btn")?.click();
        }, 0);
    }

    public render(): React.ReactNode {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    backgroundColor: "#ffffff",
                    fontFamily: "sans-serif",
                }}
            >
                {/* Custom logo */}
                <img
                    src="https://firebasestorage.googleapis.com/v0/b/laaleh-2451e.appspot.com/o/beep.svg?alt=media&token=3847db46-30c6-4a1d-8ef4-58fbcbaa7835"
                    alt="Beep Logo"
                    style={{ width: "120px", marginBottom: "20px" }}
                />

                {/* Welcome message instead of automatic redirect */}
                <h1 style={{ fontSize: "24px", marginBottom: "10px", color: "#333" }}>Welcome to Assadeq Tech</h1>
                <p style={{ fontSize: "16px", color: "#666", marginBottom: "30px" }}>
                    Secure communication powered by Matrix
                </p>

                {/* Navigation buttons */}
                <div style={{ display: "flex", gap: "15px" }}>
                    <button
                        id="auto-signin-btn"
                        onClick={() => (window.location.href = "#/login")}
                        style={{
                            padding: "12px 24px",
                            backgroundColor: "#0078d4",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "16px",
                        }}
                    >
                        Sign In
                    </button>
                </div>
            </div>
        );
    }
}
