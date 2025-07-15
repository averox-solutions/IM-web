/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type IThreepid } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Modal from "../../../Modal";
import dis from "../../../dispatcher/dispatcher";
import { getThreepidsWithBindStatus } from "../../../boundThreepids";
import IdentityAuthClient from "../../../IdentityAuthClient";
import { abbreviateUrl, parseUrl, unabbreviateUrl } from "../../../utils/UrlUtils";
import { getDefaultIdentityServerUrl, doesIdentityServerHaveTerms } from "../../../utils/IdentityServerUtils";
import { timeout } from "../../../utils/promise";
import { type ActionPayload } from "../../../dispatcher/payloads";
import InlineSpinner from "../elements/InlineSpinner";
import AccessibleButton from "../elements/AccessibleButton";
import Field from "../elements/Field";
import QuestionDialog from "../dialogs/QuestionDialog";
import SettingsFieldset from "./SettingsFieldset";
import { SettingsSubsectionText } from "./shared/SettingsSubsection";

// We'll wait up to this long when checking for 3PID bindings on the IS.
const REACHABILITY_TIMEOUT = 10000; // ms

/**
 * Check an IS URL is valid, including liveness check
 *
 * @param {string} u The url to check
 * @returns {string} null if url passes all checks, otherwise i18ned error string
 */
async function checkIdentityServerUrl(u: string): Promise<string | null> {
    const parsedUrl = parseUrl(u);

    if (parsedUrl.protocol !== "https:") return _t("identity_server|url_not_https");

    // XXX: duplicated logic from js-sdk but it's quite tied up in the validation logic in the
    // js-sdk so probably as easy to duplicate it than to separate it out so we can reuse it
    try {
        const response = await fetch(u + "/_matrix/identity/v2");
        if (response.ok) {
            return null;
        } else if (response.status < 200 || response.status >= 300) {
            return _t("identity_server|error_invalid", { code: response.status });
        } else {
            return _t("identity_server|error_connection");
        }
    } catch {
        return _t("identity_server|error_connection");
    }
}

interface IProps {
    // Whether or not the identity server is missing terms. This affects the text
    // shown to the user.
    missingTerms: boolean;
}

interface IState {
    defaultIdServer?: string;
    currentClientIdServer?: string;
    idServer: string;
    error?: string;
    busy: boolean;
    disconnectBusy: boolean;
    checking: boolean;
    reset2faLoading: boolean;
    reset2faResult: {
        secret: string;
        otpauth_url: string;
        qr: string;
        message: string;
    } | null;
    reset2faError: string | null;
}

export default class SetIdServer extends React.Component<IProps, IState> {
    private dispatcherRef?: string;

    public constructor(props: IProps) {
        super(props);

        let defaultIdServer = "";
        if (!MatrixClientPeg.safeGet().getIdentityServerUrl() && getDefaultIdentityServerUrl()) {
            // If no identity server is configured but there's one in the config, prepopulate
            // the field to help the user.
            defaultIdServer = abbreviateUrl(getDefaultIdentityServerUrl());
        }

        this.state = {
            defaultIdServer,
            currentClientIdServer: MatrixClientPeg.safeGet().getIdentityServerUrl(),
            idServer: "",
            busy: false,
            disconnectBusy: false,
            checking: false,
            reset2faLoading: false,
            reset2faResult: null,
            reset2faError: null,
        };
    }

    public componentDidMount(): void {
        this.dispatcherRef = dis.register(this.onAction);
    }

    public componentWillUnmount(): void {
        dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload): void => {
        // We react to changes in the identity server in the event the user is staring at this form
        // when changing their identity server on another device.
        if (payload.action !== "id_server_changed") return;

        this.setState({
            currentClientIdServer: MatrixClientPeg.safeGet().getIdentityServerUrl(),
        });
    };

    private onIdentityServerChanged = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        const u = ev.target.value;

        this.setState({ idServer: u });
    };

    private getTooltip = (): JSX.Element | undefined => {
        if (this.state.checking) {
            return (
                <div>
                    <InlineSpinner />
                    {_t("identity_server|checking")}
                </div>
            );
        } else if (this.state.error) {
            return <strong className="warning">{this.state.error}</strong>;
        } else {
            return undefined;
        }
    };

    private idServerChangeEnabled = (): boolean => {
        return !!this.state.idServer && !this.state.busy;
    };

    private saveIdServer = (fullUrl: string): void => {
        // Account data change will update localstorage, client, etc through dispatcher
        MatrixClientPeg.safeGet().setAccountData("m.identity_server", {
            base_url: fullUrl,
        });
        this.setState({
            busy: false,
            error: undefined,
            currentClientIdServer: fullUrl,
            idServer: "",
        });
    };

    private checkIdServer = async (e: React.SyntheticEvent): Promise<void> => {
        e.preventDefault();
        const { idServer, currentClientIdServer } = this.state;

        this.setState({ busy: true, checking: true, error: undefined });

        const fullUrl = unabbreviateUrl(idServer);

        let errStr = await checkIdentityServerUrl(fullUrl);
        if (!errStr) {
            try {
                this.setState({ checking: false }); // clear tooltip

                // Test the identity server by trying to register with it. This
                // may result in a terms of service prompt.
                const authClient = new IdentityAuthClient();

                let save = true;

                // Double check that the identity server even has terms of service.
                const hasTerms = await doesIdentityServerHaveTerms(MatrixClientPeg.safeGet(), fullUrl);
                if (!hasTerms) {
                    const [confirmed] = await this.showNoTermsWarning(fullUrl);
                    save = !!confirmed;
                }

                // Show a general warning, possibly with details about any bound
                // 3PIDs that would be left behind.
                if (save && currentClientIdServer && fullUrl !== currentClientIdServer) {
                    const [confirmed] = await this.showServerChangeWarning({
                        title: _t("identity_server|change"),
                        unboundMessage: _t(
                            "identity_server|change_prompt",
                            {},
                            {
                                current: (sub) => <strong>{abbreviateUrl(currentClientIdServer)}</strong>,
                                new: (sub) => <strong>{abbreviateUrl(idServer)}</strong>,
                            },
                        ),
                        button: _t("action|continue"),
                    });
                    save = !!confirmed;
                }

                if (save) {
                    this.saveIdServer(fullUrl);
                }
            } catch (e) {
                logger.error(e);
                errStr = _t("identity_server|error_invalid_or_terms");
            }
        }
        this.setState({
            busy: false,
            checking: false,
            error: errStr ?? undefined,
            currentClientIdServer: MatrixClientPeg.safeGet().getIdentityServerUrl(),
        });
    };

    private showNoTermsWarning(fullUrl: string): Promise<[ok?: boolean]> {
        const { finished } = Modal.createDialog(QuestionDialog, {
            title: _t("terms|identity_server_no_terms_title"),
            description: (
                <div>
                    <strong className="warning">{_t("identity_server|no_terms")}</strong>
                    <span>&nbsp;{_t("terms|identity_server_no_terms_description_2")}</span>
                </div>
            ),
            button: _t("action|continue"),
        });
        return finished;
    }

    private onDisconnectClicked = async (): Promise<void> => {
        this.setState({ disconnectBusy: true });
        try {
            const [confirmed] = await this.showServerChangeWarning({
                title: _t("identity_server|disconnect"),
                unboundMessage: _t(
                    "identity_server|disconnect_server",
                    {},
                    { idserver: (sub) => <strong>{abbreviateUrl(this.state.currentClientIdServer)}</strong> },
                ),
                button: _t("action|disconnect"),
            });
            if (confirmed) {
                this.disconnectIdServer();
            }
        } finally {
            this.setState({ disconnectBusy: false });
        }
    };

    private async showServerChangeWarning({
        title,
        unboundMessage,
        button,
    }: {
        title: string;
        unboundMessage: ReactNode;
        button: string;
    }): Promise<[ok?: boolean]> {
        const { currentClientIdServer } = this.state;

        let threepids: IThreepid[] = [];
        let currentServerReachable = true;
        try {
            threepids = await timeout(
                getThreepidsWithBindStatus(MatrixClientPeg.safeGet()),
                Promise.reject(new Error("Timeout attempting to reach identity server")),
                REACHABILITY_TIMEOUT,
            );
        } catch (e) {
            currentServerReachable = false;
            logger.warn(
                `Unable to reach identity server at ${currentClientIdServer} to check ` +
                    `for 3PIDs during IS change flow`,
            );
            logger.warn(e);
        }
        const boundThreepids = threepids.filter((tp) => tp.bound);
        let message;
        let danger = false;
        const messageElements = {
            idserver: (sub: string) => <strong>{abbreviateUrl(currentClientIdServer)}</strong>,
            b: (sub: string) => <strong>{sub}</strong>,
        };
        if (!currentServerReachable) {
            message = (
                <div>
                    <p>{_t("identity_server|disconnect_offline_warning", {}, messageElements)}</p>
                    <p>{_t("identity_server|suggestions")}</p>
                    <ul>
                        <li>{_t("identity_server|suggestions_1")}</li>
                        <li>
                            {_t(
                                "identity_server|suggestions_2",
                                {},
                                {
                                    idserver: messageElements.idserver,
                                },
                            )}
                        </li>
                        <li>{_t("identity_server|suggestions_3")}</li>
                    </ul>
                </div>
            );
            danger = true;
            button = _t("identity_server|disconnect_anyway");
        } else if (boundThreepids.length) {
            message = (
                <div>
                    <p>{_t("identity_server|disconnect_personal_data_warning_1", {}, messageElements)}</p>
                    <p>{_t("identity_server|disconnect_personal_data_warning_2")}</p>
                </div>
            );
            danger = true;
            button = _t("identity_server|disconnect_anyway");
        } else {
            message = unboundMessage;
        }

        const { finished } = Modal.createDialog(QuestionDialog, {
            title,
            description: message,
            button,
            cancelButton: _t("action|go_back"),
            danger,
        });
        return finished;
    }

    private disconnectIdServer = (): void => {
        // Account data change will update localstorage, client, etc through dispatcher
        MatrixClientPeg.safeGet().setAccountData("m.identity_server", {
            base_url: null, // clear
        });

        let newFieldVal = "";
        if (getDefaultIdentityServerUrl()) {
            // Prepopulate the client's default so the user at least has some idea of
            // a valid value they might enter
            newFieldVal = abbreviateUrl(getDefaultIdentityServerUrl());
        }

        this.setState({
            busy: false,
            error: undefined,
            currentClientIdServer: MatrixClientPeg.safeGet().getIdentityServerUrl(),
            idServer: newFieldVal,
        });
    };

    /**
     * Resets the 2FA secret for the current user by calling the /2fa/reset endpoint.
     * Fetches the username from localStorage (mx_user_id).
     * @returns The new secret, otpauth_url, qr, and message from the server.
     */
    private async reset2FA(): Promise<{
        secret: string;
        otpauth_url: string;
        qr: string;
        message: string;
    }> {
        const username = localStorage.getItem("mx_user_id");
        if (!username) {
            throw new Error("mx_user_id not found in localStorage");
        }
        const TWO_FA_API_KEY = "22641e45b21dd3626d95d9b4b21511a4";
        const response = await fetch("http://localhost:3000/2fa/reset", {
            method: "POST",
            headers: {
                "api-key": TWO_FA_API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ username }),
        });
        if (!response.ok) {
            throw new Error(`Failed to reset 2FA: ${response.statusText}`);
        }
        return response.json();
    }

    public render(): React.ReactNode {
        const { reset2faLoading, reset2faResult, reset2faError } = this.state as any;
        const bodyText = "Use the button below to reset your 2FA secret. This will generate a new secret and QR code.";
        return (
            <SettingsFieldset legend={"2FA Configurations"} description={bodyText}>
                <div style={{ marginBottom: 16 }}>
                    <AccessibleButton
                        kind="danger_sm"
                        onClick={async () => {
                            this.setState({ reset2faLoading: true, reset2faResult: null, reset2faError: null });
                            try {
                                const result = await this.reset2FA();
                                this.setState({ reset2faResult: result, reset2faLoading: false });
                            } catch (err: any) {
                                this.setState({ reset2faError: err.message || String(err), reset2faLoading: false });
                            }
                        }}
                        disabled={reset2faLoading}
                    >
                        {reset2faLoading ? "Resetting..." : "Reset 2FA"}
                    </AccessibleButton>
                </div>
                {reset2faError && (
                    <div style={{ color: 'red', marginBottom: 12 }}>{reset2faError}</div>
                )}
                {reset2faResult && (
                    <div style={{ border: '1px solid #ccc', padding: 12, borderRadius: 4 }}>
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
