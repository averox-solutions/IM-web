/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import classNames from "classnames";
import { logger } from "matrix-js-sdk/src/logger";
import { type SSOFlow, SSOAction } from "matrix-js-sdk/src/matrix";

import { _t, UserFriendlyError } from "../../../languageHandler";
import Login, { type ClientLoginFlow, type OidcNativeFlow } from "../../../Login";
import { messageForConnectionError, messageForLoginError } from "../../../utils/ErrorUtils";
import AutoDiscoveryUtils from "../../../utils/AutoDiscoveryUtils";
import AuthPage from "../../views/auth/AuthPage";
import PlatformPeg from "../../../PlatformPeg";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import { type IMatrixClientCreds } from "../../../MatrixClientPeg";
import PasswordLogin from "../../views/auth/PasswordLogin";
import InlineSpinner from "../../views/elements/InlineSpinner";
import Spinner from "../../views/elements/Spinner";
import SSOButtons from "../../views/elements/SSOButtons";
import ServerPicker from "../../views/elements/ServerPicker";
import AuthBody from "../../views/auth/AuthBody";
import AuthHeader from "../../views/auth/AuthHeader";
import AccessibleButton, { type ButtonEvent } from "../../views/elements/AccessibleButton";
import { type ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";
import { filterBoolean } from "../../../utils/arrays";
import { startOidcLogin } from "../../../utils/oidc/authorize";
import { addDataForUser, isUserDataServiceConfigured } from "../../../utils/UserDataService";
// Use the global process provided by webpack DefinePlugin for env replacement

const TWO_FA_API_KEY = process.env.REACT_APP_2FA_API_KEY;
const TWO_FA_BASE_URL = process.env.REACT_APP_2FA_URL;
// console.log("TWO_FA_API_KEY", TWO_FA_API_KEY);
// console.log("TWO_FA_BASE_URL", TWO_FA_BASE_URL);

interface IProps {
    serverConfig: ValidatedServerConfig;
    // If true, the component will consider itself busy.
    busy?: boolean;
    isSyncing?: boolean;
    // Secondary HS which we try to log into if the user is using
    // the default HS but login fails. Useful for migrating to a
    // different homeserver without confusing users.
    fallbackHsUrl?: string;
    defaultDeviceDisplayName?: string;
    fragmentAfterLogin?: string;
    defaultUsername?: string;

    // Called when the user has logged in. Params:
    // - The object returned by the login API
    onLoggedIn(data: IMatrixClientCreds): void;

    // login shouldn't know or care how registration, password recovery, etc is done.
    onRegisterClick(): void;
    onForgotPasswordClick?(): void;
    onServerConfigChange(config: ValidatedServerConfig): void;
}

interface IState {
    busy: boolean;
    busyLoggingIn?: boolean;
    errorText?: ReactNode;
    loginIncorrect: boolean;
    // can we attempt to log in or are there validation errors?
    canTryLogin: boolean;

    flows?: ClientLoginFlow[];

    // used for preserving form values when changing homeserver
    username: string;
    phoneCountry: string;
    phoneNumber: string;

    // We perform liveliness checks later, but for now suppress the errors.
    // We also track the server dead errors independently of the regular errors so
    // that we can render it differently, and override any other error the user may
    // be seeing.
    serverIsAlive: boolean;
    serverErrorIsFatal: boolean;
    serverDeadError?: ReactNode;
    show2FA: boolean;
    twoFAEnabled?: boolean;
    twoFAConfigured?: boolean;
    qr?: string;
    secret?: string;
    otpauthUrl?: string;
    twoFAMessage?: string;
    twoFAToken?: string;
}

type OnPasswordLogin = {
    (username: string, phoneCountry: undefined, phoneNumber: undefined, password: string): Promise<void>;
    (username: undefined, phoneCountry: string, phoneNumber: string, password: string): Promise<void>;
};

/*
 * A wire component which glues together login UI components and Login logic
 */
export default class LoginComponent extends React.PureComponent<IProps, IState> {
    private unmounted = false;
    private loginLogic!: Login;
    private loginCreds?: IMatrixClientCreds;
    private formattedUsername?: string;

    private readonly stepRendererMap: Record<string, () => ReactNode>;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            busy: false,
            errorText: null,
            loginIncorrect: false,
            canTryLogin: true,

            username: props.defaultUsername ? props.defaultUsername : "",
            phoneCountry: "",
            phoneNumber: "",

            serverIsAlive: true,
            serverErrorIsFatal: false,
            serverDeadError: "",
            show2FA: false,
            twoFAEnabled: undefined,
            twoFAConfigured: undefined,
            qr: undefined,
            secret: undefined,
            otpauthUrl: undefined,
            twoFAMessage: undefined,
            twoFAToken: "",
        };

        // map from login step type to a function which will render a control
        // letting you do that login type
        this.stepRendererMap = {
            "m.login.password": this.renderPasswordStep,

            // CAS and SSO are the same thing, modulo the url we link to
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "m.login.cas": () => this.renderSsoStep("cas"),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "m.login.sso": () => this.renderSsoStep("sso"),
            "oidcNativeFlow": () => this.renderOidcNativeStep(),
        };
    }

    public componentDidMount(): void {
        this.unmounted = false;
        
        // Restore 2FA state from sessionStorage if it exists
        try {
            const saved2FAState = sessionStorage.getItem("mx_2fa_state");
            const savedCreds = sessionStorage.getItem("mx_2fa_creds");
            
            if (saved2FAState && savedCreds) {
                const state = JSON.parse(saved2FAState);
                // Check if the state is recent (less than 1 hour old)
                const savedTime = state.timestamp;
                const now = Date.now();
                if (now - savedTime < 3600000) { // 1 hour
                    try {
                        this.loginCreds = JSON.parse(savedCreds);
                        // Only restore if we have valid credentials
                        if (this.loginCreds && this.loginCreds.accessToken) {
                            this.setState({
                                show2FA: true,
                                twoFAEnabled: state.twoFAEnabled,
                                twoFAConfigured: state.twoFAConfigured,
                                qr: state.qr,
                                secret: state.secret,
                                otpauthUrl: state.otpauthUrl,
                                username: state.username || "",
                                twoFAToken: state.twoFAToken || "",
                            });
                            this.formattedUsername = state.formattedUsername;
                        } else {
                            // Invalid credentials, clear state
                            sessionStorage.removeItem("mx_2fa_state");
                            sessionStorage.removeItem("mx_2fa_creds");
                        }
                    } catch (e) {
                        logger.error("Failed to restore login credentials:", e);
                        sessionStorage.removeItem("mx_2fa_state");
                        sessionStorage.removeItem("mx_2fa_creds");
                    }
                } else {
                    // State is too old, clear it
                    sessionStorage.removeItem("mx_2fa_state");
                    sessionStorage.removeItem("mx_2fa_creds");
                }
            } else if (saved2FAState && !savedCreds) {
                // Have state but no credentials, clear state
                sessionStorage.removeItem("mx_2fa_state");
            }
        } catch (e) {
            logger.error("Failed to restore 2FA state:", e);
            sessionStorage.removeItem("mx_2fa_state");
            sessionStorage.removeItem("mx_2fa_creds");
        }
        
        this.initLoginLogic(this.props.serverConfig);
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
    }

    public componentDidUpdate(prevProps: IProps): void {
        if (
            prevProps.serverConfig.hsUrl !== this.props.serverConfig.hsUrl ||
            prevProps.serverConfig.isUrl !== this.props.serverConfig.isUrl ||
            // delegatedAuthentication is only set by buildValidatedConfigFromDiscovery and won't be modified
            // so shallow comparison is fine
            prevProps.serverConfig.delegatedAuthentication !== this.props.serverConfig.delegatedAuthentication
        ) {
            // Ensure that we end up actually logging in to the right place
            this.initLoginLogic(this.props.serverConfig);
        }
    }

    public isBusy = (): boolean => !!this.state.busy || !!this.props.busy;

    public onPasswordLogin: OnPasswordLogin = async (
        username: string | undefined,
        phoneCountry: string | undefined,
        phoneNumber: string | undefined,
        password: string,
    ): Promise<void> => {
        // Prevent email login
        if (username && username.indexOf("@") > 0) {
            this.setState({
                busy: false,
                busyLoggingIn: false,
                errorText: _t("auth|email_login_disabled"),
                loginIncorrect: false,
            });
            return;
        }

        // Format username as @username:ms.beep.gov.pk
        let formattedUsername = username || "";
        if (formattedUsername) {
            if (!formattedUsername.startsWith("@")) {
                formattedUsername = "@" + formattedUsername;
            }
            if (!formattedUsername.endsWith(":ms.beep.gov.pk")) {
                formattedUsername = formattedUsername.split(":")[0] + ":ms.beep.gov.pk";
            }
            console.log("Login attempt for:", formattedUsername);
        }
        this.formattedUsername = formattedUsername; // <-- Add this line
        if (!this.state.serverIsAlive) {
            this.setState({ busy: true });
            // Do a quick liveliness check on the URLs
            let aliveAgain = true;
            try {
                await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(
                    this.props.serverConfig.hsUrl,
                    this.props.serverConfig.isUrl,
                );
                this.setState({ serverIsAlive: true, errorText: "" });
            } catch (e) {
                const componentState = AutoDiscoveryUtils.authComponentStateForError(e);
                this.setState({
                    busy: false,
                    busyLoggingIn: false,
                    ...componentState,
                });
                aliveAgain = !componentState.serverErrorIsFatal;
            }

            // Prevent people from submitting their password when something isn't right.
            if (!aliveAgain) {
                return;
            }
        }

        // Clear any previously saved 2FA state when starting a new login attempt
        sessionStorage.removeItem("mx_2fa_state");
        sessionStorage.removeItem("mx_2fa_creds");

        this.setState({
            busy: true,
            busyLoggingIn: true,
            errorText: null,
            loginIncorrect: false,
        });

        this.loginLogic.loginViaPassword(username, phoneCountry, phoneNumber, password).then(
            async (data) => {
                this.setState({ serverIsAlive: true, busy: false, busyLoggingIn: false });
                this.loginCreds = data;
                try {
                    // 1) Check 2FA status first
                    const statusRes = await fetch(`${TWO_FA_BASE_URL}/2fa/status/${encodeURIComponent(formattedUsername)}`, {
                        method: "GET",
                        headers: {
                            "api-key": TWO_FA_API_KEY as string,
                            "Content-Type": "application/json",
                        },
                    });
                    const status = await statusRes.json();
                    console.log("2FA status response:", status);
                    if (!statusRes.ok) throw new Error(status?.error || "Failed to fetch 2FA status");

                    const isEnabled = !!status.isEnabled;
                    const isConfigured = !!status.isConfigured;
                    console.log("2FA status - isEnabled:", isEnabled, "isConfigured:", isConfigured);

                    if (!isEnabled) {
                        // 2) 2FA disabled → skip 2FA flow and complete login
                        // Clear any saved 2FA state since we're not using it
                        sessionStorage.removeItem("mx_2fa_state");
                        sessionStorage.removeItem("mx_2fa_creds");
                        
                        // Send user data to backend before completing login
                        if (isUserDataServiceConfigured() && this.loginCreds?.userId) {
                            await addDataForUser(this.loginCreds.userId);
                        }
                        this.props.onLoggedIn(this.loginCreds!);
                        return;
                    }

                    // 3) 2FA enabled → show 2FA UI
                    let qrValue: string | undefined;
                    let secretValue: string | undefined;
                    let otpauthUrlValue: string | undefined;
                    
                    if (!isConfigured) {
                        // 3a) Not configured → generate secret and show QR
                        console.log("User not configured, generating QR...");
                        const genRes = await fetch(`${TWO_FA_BASE_URL}/2fa/generate`, {
                        method: "POST",
                        headers: {
                                "api-key": TWO_FA_API_KEY as string,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ username: formattedUsername }),
                    });
                        const gen = await genRes.json();
                        console.log("Generate response:", gen);
                        if (!genRes.ok) throw new Error(gen?.error || "Failed to initiate 2FA");
                        qrValue = gen.qr;
                        secretValue = gen.secret;
                        otpauthUrlValue = gen.otpauth_url;
                    this.setState({
                        show2FA: true,
                            twoFAEnabled: true,
                            twoFAConfigured: isConfigured,
                            qr: qrValue,
                            secret: secretValue,
                            otpauthUrl: otpauthUrlValue,
                            twoFAMessage: gen.message,
                        });
                    } else {
                        // 3b) Already configured → show only OTP input (no QR)
                        console.log("User already configured, showing OTP input only");
                        this.setState({
                            show2FA: true,
                            twoFAEnabled: true,
                            twoFAConfigured: isConfigured,
                            qr: undefined,
                            secret: undefined,
                            otpauthUrl: undefined,
                        });
                    }
                    
                    // Save 2FA state to sessionStorage for persistence across refreshes
                    try {
                        sessionStorage.setItem("mx_2fa_state", JSON.stringify({
                            show2FA: true,
                            twoFAEnabled: true,
                            twoFAConfigured: isConfigured,
                            qr: qrValue,
                            secret: secretValue,
                            otpauthUrl: otpauthUrlValue,
                            username: this.state.username,
                            formattedUsername: formattedUsername,
                            twoFAToken: this.state.twoFAToken || "",
                            timestamp: Date.now(),
                        }));
                        // Also save login credentials temporarily
                        if (this.loginCreds) {
                            sessionStorage.setItem("mx_2fa_creds", JSON.stringify(this.loginCreds));
                        }
                    } catch (e) {
                        logger.error("Failed to save 2FA state:", e);
                    }
                } catch (e) {
                    this.setState({ errorText: "Failed to load 2FA setup. Please try again." });
                }
            },
            (error) => {
                if (this.unmounted) return;

                let errorText: ReactNode;
                // Some error strings only apply for logging in
                if (error.httpStatus === 400 && username && username.indexOf("@") > 0) {
                    errorText = _t("auth|unsupported_auth_email");
                } else {
                    errorText = messageForLoginError(error, this.props.serverConfig);
                }

                this.setState({
                    busy: false,
                    busyLoggingIn: false,
                    errorText,
                    // 401 would be the sensible status code for 'incorrect password'
                    // but the login API gives a 403 https://matrix.org/jira/browse/SYN-744
                    // mentions this (although the bug is for UI auth which is not this)
                    // We treat both as an incorrect password
                    loginIncorrect: error.httpStatus === 401 || error.httpStatus === 403,
                });
            },
        );
    };

    private autoTriggerSsoLoginIfApplicable(): void {
        const ssoFlow = this.state.flows?.find(
            (flow) => flow.type === "m.login.sso" || flow.type === "m.login.cas",
        ) as SSOFlow | undefined;
    
        if (ssoFlow) {
            const ssoKind = ssoFlow.type === "m.login.cas" ? "cas" : "sso";
    
            PlatformPeg.get()?.startSingleSignOn(
                this.loginLogic.createTemporaryClient(),
                ssoKind,
                this.props.fragmentAfterLogin,
            );
        }
    }
    
    

    public onUsernameChanged = (username: string): void => {
        this.setState({ username });
    };

    public onUsernameBlur = async (username: string): Promise<void> => {
        const doWellknownLookup = username[0] === "@";
        this.setState({
            username: username,
            busy: doWellknownLookup,
            errorText: null,
            canTryLogin: true,
        });
        if (doWellknownLookup) {
            const serverName = username.split(":").slice(1).join(":");
            try {
                const result = await AutoDiscoveryUtils.validateServerName(serverName);
                this.props.onServerConfigChange(result);
                // We'd like to rely on new props coming in via `onServerConfigChange`
                // so that we know the servers have definitely updated before clearing
                // the busy state. In the case of a full MXID that resolves to the same
                // HS as Element's default HS though, there may not be any server change.
                // To avoid this trap, we clear busy here. For cases where the server
                // actually has changed, `initLoginLogic` will be called and manages
                // busy state for its own liveness check.
                this.setState({
                    busy: false,
                });
            } catch (e) {
                logger.error("Problem parsing URL or unhandled error doing .well-known discovery:", e);

                let message = _t("auth|failed_homeserver_discovery");
                if (e instanceof UserFriendlyError && e.translatedMessage) {
                    message = e.translatedMessage;
                }

                let errorText: ReactNode = message;
                let discoveryState = {};
                if (AutoDiscoveryUtils.isLivelinessError(e)) {
                    errorText = this.state.errorText;
                    discoveryState = AutoDiscoveryUtils.authComponentStateForError(e);
                }

                this.setState({
                    busy: false,
                    errorText,
                    ...discoveryState,
                });
            }
        }
    };

    public onPhoneCountryChanged = (phoneCountry: string): void => {
        this.setState({ phoneCountry });
    };

    public onPhoneNumberChanged = (phoneNumber: string): void => {
        this.setState({ phoneNumber });
    };

    public onRegisterClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        this.props.onRegisterClick();
    };

    public onTryRegisterClick = (ev: ButtonEvent): void => {
        const hasPasswordFlow = this.state.flows?.find((flow) => flow.type === "m.login.password");
        const ssoFlow = this.state.flows?.find((flow) => flow.type === "m.login.sso" || flow.type === "m.login.cas");
        // If has no password flow but an SSO flow guess that the user wants to register with SSO.
        // TODO: instead hide the Register button if registration is disabled by checking with the server,
        // has no specific errCode currently and uses M_FORBIDDEN.
        if (ssoFlow && !hasPasswordFlow) {
            ev.preventDefault();
            ev.stopPropagation();
            const ssoKind = ssoFlow.type === "m.login.sso" ? "sso" : "cas";
            PlatformPeg.get()?.startSingleSignOn(
                this.loginLogic.createTemporaryClient(),
                ssoKind,
                this.props.fragmentAfterLogin,
                undefined,
                SSOAction.REGISTER,
            );
        } else {
            // Don't intercept - just go through to the register page
            this.onRegisterClick(ev);
        }
    };

    private async checkServerLiveliness({
        hsUrl,
        isUrl,
    }: Pick<ValidatedServerConfig, "hsUrl" | "isUrl">): Promise<void> {
        // Do a quick liveliness check on the URLs
        try {
            const { warning } = await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(hsUrl, isUrl);
            if (warning) {
                this.setState({
                    ...AutoDiscoveryUtils.authComponentStateForError(warning),
                    errorText: "",
                });
            } else {
                this.setState({
                    serverIsAlive: true,
                    errorText: "",
                });
            }
        } catch (e) {
            this.setState({
                busy: false,
                ...AutoDiscoveryUtils.authComponentStateForError(e as Error),
            });
        }
    }

    private async initLoginLogic({ hsUrl, isUrl }: ValidatedServerConfig): Promise<void> {
        const isDefaultServer =
            this.props.serverConfig.isDefault &&
            hsUrl === this.props.serverConfig.hsUrl &&
            isUrl === this.props.serverConfig.isUrl;
    
        const fallbackHsUrl = isDefaultServer ? this.props.fallbackHsUrl! : null;
    
        this.setState({
            busy: true,
            loginIncorrect: false,
        });
    
        try {
            // Check if the server is alive before attempting login
            await this.checkServerLiveliness({ hsUrl, isUrl });
    
            // Initialize login logic
            this.loginLogic = new Login(hsUrl, isUrl, fallbackHsUrl, {
                defaultDeviceDisplayName: this.props.defaultDeviceDisplayName,
                delegatedAuthentication: this.props.serverConfig.delegatedAuthentication,
            });
    
            const flows = await this.loginLogic.getFlows();
            const supportedFlows = flows.filter(this.isSupportedFlow);
    
            if (supportedFlows.length === 0) {
                this.setState({ errorText: _t("auth|unsupported_auth") });
            }
    
            this.setState({ flows: supportedFlows }, () => {
                // Optionally trigger SSO login if it's the only supported flow
                if (
                    supportedFlows.length === 1 &&
                    (supportedFlows[0].type === "m.login.sso" || supportedFlows[0].type === "m.login.cas")
                ) {
                    this.autoTriggerSsoLoginIfApplicable();
                }
            });
    
        } catch (error) {
            // If server check or flow fetch fails
            this.setState({
                errorText: messageForConnectionError(error as Error, this.props.serverConfig),
                loginIncorrect: false,
                canTryLogin: false,
            });
        } finally {
            this.setState({ busy: false });
        }
    }
    
    private isSupportedFlow = (flow: ClientLoginFlow): boolean => {
        // technically the flow can have multiple steps, but no one does this
        // for login and loginLogic doesn't support it so we can ignore it.
        if (!this.stepRendererMap[flow.type]) {
            logger.log("Skipping flow", flow, "due to unsupported login type", flow.type);
            return false;
        }
        return true;
    };

    private on2FASubmit = async (): Promise<void> => {
        const usernameToVerify = this.formattedUsername ?? this.state.username; // Use fallback for username
        try {
            const response = await fetch(`${TWO_FA_BASE_URL}/2fa/verify`, {
                method: "POST",
                headers: {
                    "api-key": TWO_FA_API_KEY as string,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: usernameToVerify,
                    token: this.state.twoFAToken,
                }),
            });
            const text = await response.text();
            console.log("2FA verify response:", text);

            let result;
            try {
                result = JSON.parse(text);
            } catch (e) {
                throw new Error("Invalid response from 2FA server");
            }
            if (!response.ok || result?.error) {
                throw new Error(result?.error || "Invalid 2FA token");
            }
            
            console.log("2FA verification successful, logging in user");
            // Clear saved 2FA state since login is successful
            sessionStorage.removeItem("mx_2fa_state");
            sessionStorage.removeItem("mx_2fa_creds");
            
            // Send user data to backend after successful 2FA verification
            if (isUserDataServiceConfigured() && this.loginCreds?.userId) {
                await addDataForUser(this.loginCreds.userId);
            }
            this.props.onLoggedIn(this.loginCreds!);
        } catch (e) {
            this.setState({ errorText: "Invalid 2FA code. Please try again." });
        }
    };

    private handleCopySecret = async (): Promise<void> => {
        if (this.state.secret) {
            try {
                // Try modern Clipboard API first
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(this.state.secret);
                } else {
                    // Fallback: Create temporary textarea and select
                    const textarea = document.createElement("textarea");
                    textarea.value = this.state.secret;
                    textarea.style.position = "fixed";
                    textarea.style.opacity = "0";
                    textarea.style.pointerEvents = "none";
                    document.body.appendChild(textarea);
                    textarea.select();
                    textarea.setSelectionRange(0, 99999); // For mobile devices
                    try {
                        document.execCommand("copy");
                    } catch (err) {
                        logger.error("execCommand copy failed:", err);
                    }
                    document.body.removeChild(textarea);
                }
            } catch (err) {
                logger.error("Failed to copy secret:", err);
            }
        }
    };

    public renderLoginComponentForFlows(): ReactNode {
        if (this.state.show2FA) {
            const showQr = this.state.twoFAEnabled && this.state.twoFAConfigured === false && !!this.state.qr;
            const showOnlyInput = this.state.twoFAEnabled && this.state.twoFAConfigured === true;
        
            return (
                <div
                    className="mx_Login_2FA"
                    style={{
                        marginTop: 32,
                        maxWidth: 400,
                        marginLeft: "auto",
                        marginRight: "auto",
                        padding: "0 20px 20px 20px",
                        border: "none",
                        borderRadius: "8px",
                        display:"flex",
                        alignItems:"center",
                        justifyContent:"center",
                        flexWrap: "nowrap",
                        flexDirection:"column"
                        
                    }}
                >
                    <h3 className="mx_Login_2FA_title" style={{ textAlign: "center", marginBottom: "-8px", fontSize: "20px",color:"black",marginTop:"-11px",paddingBottom:"3%"}}>
                        Two-Factor Authentication
                    </h3>
        
                    {showQr && (
                        <div style={{ textAlign: "center", fontSize:"16px" }}>
                            <img
                                src={this.state.qr}
                                alt="QR Code for 2FA"
                                style={{ maxWidth: "180px", margin: "0 auto", display: "block" }}
                            />
                            <p style={{ fontSize: "14px", marginTop: 12, color: "black" }}>
                                Scan this QR code with your authenticator app.
                            </p>
                            <div style={{ fontSize: "13px", color: "black", wordBreak: "break-word", display: "flex", alignItems: "center", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                                <span>Or use this secret (double-click to copy):</span>
                                <code
                                    id="2fa-secret-code"
                                    onDoubleClick={this.handleCopySecret}
                                    style={{
                                        backgroundColor: "#f4f4f4",
                                        padding: "4px 6px",
                                        borderRadius: "4px",
                                        fontFamily: "monospace",
                                        fontSize: "13px",
                                        userSelect: "text",
                                        WebkitUserSelect: "text",
                                        MozUserSelect: "text",
                                        msUserSelect: "text",
                                        cursor: "text",
                                        display: "inline-block",
                                    }}
                                >
                                    {this.state.secret}
                                </code>
                            </div>
                        </div>
                    )}
        
                    {showOnlyInput && (
                        <p style={{ textAlign: "center", color: "black", marginBottom: 16, fontSize: "16px" }}>
                            2FA is already set up. Please enter your 6 digit code below.
                        </p>
                    )}
        
                    <input
                        type="text"
                        className="mx_Login_2FA_input"
                        placeholder="Enter 6-digit OTP"
                        value={this.state.twoFAToken || ""}
                        onChange={(e) => {
                            const newToken = e.target.value;
                            this.setState({ twoFAToken: newToken });
                            // Update saved state with new token
                            if (this.state.show2FA) {
                                try {
                                    const savedState = sessionStorage.getItem("mx_2fa_state");
                                    if (savedState) {
                                        const state = JSON.parse(savedState);
                                        state.twoFAToken = newToken;
                                        sessionStorage.setItem("mx_2fa_state", JSON.stringify(state));
                                    }
                                } catch (err) {
                                    logger.error("Failed to update 2FA token in storage:", err);
                                }
                            }
                        }}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        style={{
                            display: "block",
                            width: "100%",
                            padding: "12px",
                            fontSize: "16px",
                            border: "1px solid black",
                            borderRadius: "17px",
                            marginBottom: "20px",
                            boxSizing: "border-box",
                            color: "black",
                            textAlign: "center",
                        }}
                    />
        
                    <AccessibleButton
                        kind="primary"
                        className="mx_Login_2FA_button"
                        onClick={this.on2FASubmit}
                        style={{
                            width: "80%",
                            padding: "12px",
                            fontSize: "16px",
                            borderRadius: "6px",
                            backgroundColor: "#488d41",
                            color: "black",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "center",
                        }}
                    >
                        Verify OTP
                    </AccessibleButton>
                </div>
            );
        }
        

        if (!this.state.flows) return null;

        const order = ["oidcNativeFlow", "m.login.password", "m.login.sso"];
        const flows = filterBoolean(order.map((type) => this.state.flows?.find((flow) => flow.type === type)));

        return (
            <React.Fragment>
                {flows.map((flow) => {
                    const stepRenderer = this.stepRendererMap[flow.type];
                    return <React.Fragment key={flow.type}>{stepRenderer()}</React.Fragment>;
                })}
            </React.Fragment>
        );
    }

    private renderPasswordStep = (): JSX.Element => {
        return (
            <PasswordLogin
                onSubmit={this.onPasswordLogin}
                username={this.state.username}
                phoneCountry={this.state.phoneCountry}
                phoneNumber={this.state.phoneNumber}
                onUsernameChanged={this.onUsernameChanged}
                onUsernameBlur={this.onUsernameBlur}
                onPhoneCountryChanged={this.onPhoneCountryChanged}
                onPhoneNumberChanged={this.onPhoneNumberChanged}
                onForgotPasswordClick={this.props.onForgotPasswordClick}
                loginIncorrect={this.state.loginIncorrect}
                serverConfig={this.props.serverConfig}
                disableSubmit={this.isBusy()}
                busy={this.props.isSyncing || this.state.busyLoggingIn}
                showPassword={false}
            />
        );
    };

    private renderOidcNativeStep = (): React.ReactNode => {
        const flow = this.state.flows!.find((flow) => flow.type === "oidcNativeFlow")! as OidcNativeFlow;
        return (
            <AccessibleButton
                className="mx_Login_fullWidthButton"
                kind="primary"
                onClick={async () => {
                    await startOidcLogin(
                        this.props.serverConfig.delegatedAuthentication!,
                        flow.clientId,
                        this.props.serverConfig.hsUrl,
                        this.props.serverConfig.isUrl,
                    );
                }}
            >
                {_t("action|continue")}
            </AccessibleButton>
        );
    };

    private renderSsoStep = (loginType: "cas" | "sso"): JSX.Element => {
        const flow = this.state.flows?.find((flow) => flow.type === "m.login." + loginType) as SSOFlow;

        return (
            <SSOButtons
                matrixClient={this.loginLogic.createTemporaryClient()}
                flow={flow}
                loginType={loginType}
                fragmentAfterLogin={this.props.fragmentAfterLogin}
                primary={!this.state.flows?.find((flow) => flow.type === "m.login.password")}
                action={SSOAction.LOGIN}
                disabled={this.isBusy()}
            />
        );
    };

    public render(): React.ReactNode {
        const loader =
            this.isBusy() && !this.state.busyLoggingIn ? (
                <div className="mx_Login_loader">
                    <Spinner />
                </div>
            ) : null;

        const errorText = this.state.errorText;

        let errorTextSection;
        if (errorText) {
            errorTextSection = <div className="mx_Login_error">{errorText}</div>;
        }

        let serverDeadSection;
        if (!this.state.serverIsAlive) {
            const classes = classNames({
                mx_Login_error: true,
                mx_Login_serverError: true,
                mx_Login_serverErrorNonFatal: !this.state.serverErrorIsFatal,
            });
            serverDeadSection = <div className={classes}>{this.state.serverDeadError}</div>;
        }

        let footer;
        if (this.props.isSyncing || this.state.busyLoggingIn) {
            footer = (
                <div className="mx_AuthBody_paddedFooter">
                    <div className="mx_AuthBody_paddedFooter_title">
                        <InlineSpinner w={20} h={20} />
                        {this.props.isSyncing ? _t("auth|syncing") : _t("auth|signing_in")}
                    </div>
                    {this.props.isSyncing && (
                        <div className="mx_AuthBody_paddedFooter_subtitle">{_t("auth|sync_footer_subtitle")}</div>
                    )}
                </div>
            );
        } else if (SettingsStore.getValue(UIFeature.Registration)) {
            footer = (
                <span className="mx_AuthBody_changeFlow">
                    {_t(
                        "auth|create_account_prompt",
                        {},
                        {
                            a: (sub) => (
                                <AccessibleButton kind="link_inline" onClick={this.onTryRegisterClick}>
                                    {sub}
                                </AccessibleButton>
                            ),
                        },
                    )}
                </span>
            );
        }

        return (
            <AuthPage>
                <AuthHeader disableLanguageSelector={this.props.isSyncing || this.state.busyLoggingIn} />
                <AuthBody>
                    <h1>
                        {_t("action|sign_in")}
                        {loader}
                    </h1>
                    {errorTextSection}
                    {serverDeadSection}
                    <ServerPicker
                        serverConfig={this.props.serverConfig}
                        onServerConfigChange={this.props.onServerConfigChange}
                        disabled={this.isBusy()}
                    />
                    {this.renderLoginComponentForFlows()}
                    {footer}
                </AuthBody>
            </AuthPage>
        );
    }
}