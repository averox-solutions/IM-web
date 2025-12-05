/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import SdkConfig from "../../../SdkConfig";
import { type ButtonEvent } from "../../views/elements/AccessibleButton";
import { _t } from "../../../languageHandler";
import Spinner from "../../views/elements/Spinner";
import AccessibleButton from "../../views/elements/AccessibleButton";

interface Props {
    /** The matrix client which is logging in */
    matrixClient: MatrixClient;

    /**
     * A callback function. Will be called if the user clicks the "logout" button on the splash screen.
     *
     * @param event - The click event
     */
    onLogoutClick: (event: ButtonEvent) => void;

    /**
     * Error that caused `/sync` to fail. If set, an error message will be shown on the splash screen.
     */
    syncError: Error | null;
}

/**
 * The view that is displayed after we have logged in, before the first /sync is completed.
 */
export function LoginSplashView(props: Props): React.JSX.Element {
    const brandingConfig = SdkConfig.getObject("branding");
    const logoUrl = brandingConfig?.get("auth_header_logo_url") ?? "themes/element/img/logos/element-logo.svg";
    const config = SdkConfig.get();

    return (
        <div className="mx_MatrixChat_splash">
            <div className="mx_LoginSplashView_container">
                <div className="mx_LoginSplashView_content">
                    {/* Logo */}
                    <div className="mx_LoginSplashView_logo">
                        <img src={logoUrl} alt={config.brand || "Beep Pakistan"} />
                    </div>

                    {/* Loading Spinner */}
                    {!props.syncError && (
                        <div className="mx_LoginSplashView_spinner">
                            <Spinner w={48} h={48} />
                        </div>
                    )}

                    {/* Error Message */}
                    {props.syncError && (
                        <div className="mx_LoginSplashView_syncError">
                            <h2>{_t("error|something_went_wrong")}</h2>
                            <p>{props.syncError.message || _t("error|sync")}</p>
                        </div>
                    )}

                    {/* Logout Button */}
                    <div className="mx_LoginSplashView_splashButtons">
                        <AccessibleButton
                            kind="primary_outline"
                            onClick={props.onLogoutClick}
                            className="mx_LoginSplashView_logoutButton"
                        >
                            {_t("action|sign_out")}
                        </AccessibleButton>
                    </div>
                </div>
            </div>
        </div>
    );
}