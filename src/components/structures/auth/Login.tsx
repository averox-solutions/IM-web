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

interface IProps {
    serverConfig: ValidatedServerConfig;
    // If true, the component will consider itself busy.
    busy?: boolean;
    isVerifying2FA: boolean;

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
    canTryLogin: boolean;
    flows?: ClientLoginFlow[];
    username: string;
    phoneCountry: string;
    phoneNumber: string;
    serverIsAlive: boolean;
    serverErrorIsFatal: boolean;
    serverDeadError?: ReactNode;
    show2FA: boolean;
    qr?: string;
    secret?: string;
    otpauthUrl?: string;
    twoFAMessage?: string;
    twoFAToken?: string;
    isVerifying2FA: boolean; // ✅ Added this here
    isVerified: boolean; 
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
            isVerifying2FA: false, // ✅ Initialize
            isVerified: false, 
            serverIsAlive: true,
            serverErrorIsFatal: false,
            serverDeadError: "",
            show2FA: false,
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
    
        // ✅ Check if 2FA state exists in localStorage
        const savedTwoFAState = localStorage.getItem("twoFAState");
        if (savedTwoFAState) {
            try {
                const { show2FA, formattedUsername, loginCreds } = JSON.parse(savedTwoFAState);
    
                if (show2FA && formattedUsername && loginCreds) {
                    console.log("Restoring 2FA state after refresh...");
    
                    // ✅ Restore 2FA state in component
                    this.setState({
                        show2FA: true,
                        twoFAMessage: "Enter your 6-digit 2FA code",
                        busy: false,
                        busyLoggingIn: false,
                    });
    
                    this.formattedUsername = formattedUsername;
                    this.loginCreds = loginCreds;
    
                    return; // ✅ Skip normal login initialization
                }
            } catch (e) {
                console.error("Failed to restore 2FA state:", e);
                localStorage.removeItem("twoFAState"); // Clean up corrupted data
            }
        }
    
        // ✅ If no saved 2FA state, initialize login as usual
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
        // ✅ Format username as @username:ms.beep.gov.pk
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
        this.formattedUsername = formattedUsername;
    
        // ✅ Check if server is alive before attempting login
        if (!this.state.serverIsAlive) {
            this.setState({ busy: true });
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
                if (componentState.serverErrorIsFatal) return;
            }
        }
    
        // ✅ Set UI as busy
        this.setState({
            busy: true,
            busyLoggingIn: true,
            errorText: null,
            loginIncorrect: false,
        });
    
        try {
            // ✅ Attempt password login
            const data = await this.loginLogic.loginViaPassword(username, phoneCountry, phoneNumber, password);
            this.setState({ serverIsAlive: true, busy: false, busyLoggingIn: false });
            this.loginCreds = data;
    
            const TWO_FA_API_KEY = process.env.REACT_APP_2FA_API_KEY;
    
            // ✅ Check 2FA status from API
            const statusResponse = await fetch(
                `https://em4.averox.com/2fa/status/${encodeURIComponent(formattedUsername)}`,
                {
                    method: "GET",
                    headers: {
                        "api-key": TWO_FA_API_KEY,
                        "Content-Type": "application/json",
                    },
                }
            );
    
            const statusResult = await statusResponse.json();
            if (!statusResponse.ok) throw new Error(statusResult?.error || "Failed to check 2FA status");
    
            const { isEnabled } = statusResult;
    
            if (isEnabled) {
                // ✅ Persist 2FA state in localStorage for refresh
                const twoFAData = {
                    show2FA: true,
                    formattedUsername,
                    loginCreds: this.loginCreds,
                };
                localStorage.setItem("twoFAState", JSON.stringify(twoFAData));
    
                // ✅ Show 2FA UI
                this.setState({
                    show2FA: true,
                    twoFAMessage: "Enter your 6-digit 2FA code",
                });
            } else {
                // ✅ If no 2FA, log in directly
                localStorage.removeItem("twoFAState");
                this.props.onLoggedIn(this.loginCreds!);
            }
        } catch (error: any) {
            if (this.unmounted) return;
    
            // ✅ Handle errors gracefully
            let errorText: ReactNode;
            if (error.httpStatus === 400 && username && username.indexOf("@") > 0) {
                errorText = _t("auth|unsupported_auth_email");
            } else if (error.message?.includes("2FA")) {
                errorText = "Failed to process 2FA. Please try again.";
            } else {
                errorText = messageForLoginError(error, this.props.serverConfig);
            }
    
            this.setState({
                busy: false,
                busyLoggingIn: false,
                errorText,
                loginIncorrect: error.httpStatus === 401 || error.httpStatus === 403,
            });
        }
    };
    
    // ✅ Add a helper function to clear storage and refresh page
    private handleGoBackToLogin = (): void => {
        localStorage.removeItem("twoFAState");
        window.location.reload();
    };
    
    // public onPasswordLogin: OnPasswordLogin = async (
    //     username: string | undefined,
    //     phoneCountry: string | undefined,
    //     phoneNumber: string | undefined,
    //     password: string,
    // ): Promise<void> => {
    //     // ✅ Format username as @username:ms.beep.gov.pk
    //     let formattedUsername = username || "";
    //     if (formattedUsername) {
    //         if (!formattedUsername.startsWith("@")) {
    //             formattedUsername = "@" + formattedUsername;
    //         }
    //         if (!formattedUsername.endsWith(":ms.beep.gov.pk")) {
    //             formattedUsername = formattedUsername.split(":")[0] + ":ms.beep.gov.pk";
    //         }
    //         console.log("Login attempt for:", formattedUsername);
    //     }
    //     this.formattedUsername = formattedUsername;
    
    //     // ✅ Check if server is alive before attempting login
    //     if (!this.state.serverIsAlive) {
    //         this.setState({ busy: true });
    //         try {
    //             await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(
    //                 this.props.serverConfig.hsUrl,
    //                 this.props.serverConfig.isUrl,
    //             );
    //             this.setState({ serverIsAlive: true, errorText: "" });
    //         } catch (e) {
    //             const componentState = AutoDiscoveryUtils.authComponentStateForError(e);
    //             this.setState({
    //                 busy: false,
    //                 busyLoggingIn: false,
    //                 ...componentState,
    //             });
    //             if (componentState.serverErrorIsFatal) return;
    //         }
    //     }
    
    //     // ✅ Set UI as busy
    //     this.setState({
    //         busy: true,
    //         busyLoggingIn: true,
    //         errorText: null,
    //         loginIncorrect: false,
    //     });
    
    //     try {
    //         // ✅ Attempt password login
    //         const data = await this.loginLogic.loginViaPassword(username, phoneCountry, phoneNumber, password);
    //         this.setState({ serverIsAlive: true, busy: false, busyLoggingIn: false });
    //         this.loginCreds = data;
    
    //         const TWO_FA_API_KEY = "cd61775633b58a3f6c630d7a15e335f6";
    
    //         // ✅ Check 2FA status from API
    //         const statusResponse = await fetch(
    //             `https://em4.averox.com/2fa/status/${encodeURIComponent(formattedUsername)}`,
    //             {
    //                 method: "GET",
    //                 headers: {
    //                     "api-key": TWO_FA_API_KEY,
    //                     "Content-Type": "application/json",
    //                 },
    //             }
    //         );
    
    //         const statusResult = await statusResponse.json();
    //         if (!statusResponse.ok) throw new Error(statusResult?.error || "Failed to check 2FA status");
    
    //         const { isEnabled } = statusResult;
    
    //         if (isEnabled) {
    //             // ✅ Persist 2FA state in localStorage for refresh
    //             const twoFAData = {
    //                 show2FA: true,
    //                 formattedUsername,
    //                 loginCreds: this.loginCreds,
    //             };
    //             localStorage.setItem("twoFAState", JSON.stringify(twoFAData));
    
    //             this.setState({
    //                 show2FA: true,
    //                 twoFAMessage: "Enter your 6-digit 2FA code",
    //             });
    //         } else {
    //             // ✅ If no 2FA, log in directly
    //             localStorage.removeItem("twoFAState");
    //             this.props.onLoggedIn(this.loginCreds!);
    //         }
    //     } catch (error: any) {
    //         if (this.unmounted) return;
    
    //         // ✅ Handle errors gracefully
    //         let errorText: ReactNode;
    //         if (error.httpStatus === 400 && username && username.indexOf("@") > 0) {
    //             errorText = _t("auth|unsupported_auth_email");
    //         } else if (error.message?.includes("2FA")) {
    //             errorText = "Failed to process 2FA. Please try again.";
    //         } else {
    //             errorText = messageForLoginError(error, this.props.serverConfig);
    //         }
    
    //         this.setState({
    //             busy: false,
    //             busyLoggingIn: false,
    //             errorText,
    //             loginIncorrect: error.httpStatus === 401 || error.httpStatus === 403,
    //         });
    //     }
    // };
    

    // public onPasswordLogin: OnPasswordLogin = async (
    //     username: string | undefined,
    //     phoneCountry: string | undefined,
    //     phoneNumber: string | undefined,
    //     password: string,
    // ): Promise<void> => {
    //     // ✅ Format username as @username:ms.beep.gov.pk
    //     let formattedUsername = username || "";
    //     if (formattedUsername) {
    //         if (!formattedUsername.startsWith("@")) {
    //             formattedUsername = "@" + formattedUsername;
    //         }
    //         if (!formattedUsername.endsWith(":ms.beep.gov.pk")) {
    //             formattedUsername = formattedUsername.split(":")[0] + ":ms.beep.gov.pk";
    //         }
    //         console.log("Login attempt for:", formattedUsername);
    //     }
    //     this.formattedUsername = formattedUsername;
    
    //     // ✅ Check if server is alive
    //     if (!this.state.serverIsAlive) {
    //         this.setState({ busy: true });
    //         try {
    //             await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(
    //                 this.props.serverConfig.hsUrl,
    //                 this.props.serverConfig.isUrl,
    //             );
    //             this.setState({ serverIsAlive: true, errorText: "" });
    //         } catch (e) {
    //             const componentState = AutoDiscoveryUtils.authComponentStateForError(e);
    //             this.setState({
    //                 busy: false,
    //                 busyLoggingIn: false,
    //                 ...componentState,
    //             });
    //             if (componentState.serverErrorIsFatal) return;
    //         }
    //     }
    
    //     // ✅ Set login state to busy
    //     this.setState({
    //         busy: true,
    //         busyLoggingIn: true,
    //         errorText: null,
    //         loginIncorrect: false,
    //     });
    
    //     try {
    //         // ✅ Attempt password login
    //         const data = await this.loginLogic.loginViaPassword(username, phoneCountry, phoneNumber, password);
    //         this.setState({ serverIsAlive: true, busy: false, busyLoggingIn: false });
    //         this.loginCreds = data;
    
    //         const TWO_FA_API_KEY = "cd61775633b58a3f6c630d7a15e335f6";
    
    //         // ✅ Check 2FA status from API
    //         const statusResponse = await fetch(
    //             `https://em4.averox.com/2fa/status/${encodeURIComponent(formattedUsername)}`,
    //             {
    //                 method: "GET",
    //                 headers: {
    //                     "api-key": TWO_FA_API_KEY,
    //                     "Content-Type": "application/json",
    //                 },
    //             }
    //         );
    
    //         const statusResult = await statusResponse.json();
    //         if (!statusResponse.ok) throw new Error(statusResult?.error || "Failed to check 2FA status");
    
    //         const { isEnabled } = statusResult;
    
    //         if (isEnabled) {
    //             // ✅ 2FA enabled → show verification screen
    //             this.setState({
    //                 show2FA: true,
    //                 twoFAMessage: "Enter your 6-digit 2FA code",
    //             });
    //         } else {
    //             // ✅ 2FA disabled → log the user in immediately
    //             this.props.onLoggedIn(this.loginCreds!);
    //         }
    //     } catch (error: any) {
    //         if (this.unmounted) return;
    
    //         // ✅ Handle login or 2FA status check error
    //         let errorText: ReactNode;
    //         if (error.httpStatus === 400 && username && username.indexOf("@") > 0) {
    //             errorText = _t("auth|unsupported_auth_email");
    //         } else if (error.message?.includes("2FA")) {
    //             errorText = "Failed to process 2FA. Please try again.";
    //         } else {
    //             errorText = messageForLoginError(error, this.props.serverConfig);
    //         }
    
    //         this.setState({
    //             busy: false,
    //             busyLoggingIn: false,
    //             errorText,
    //             loginIncorrect: error.httpStatus === 401 || error.httpStatus === 403,
    //         });
    //     }
    // };


    // public onPasswordLogin: OnPasswordLogin = async (
    //     username: string | undefined,
    //     phoneCountry: string | undefined,
    //     phoneNumber: string | undefined,
    //     password: string,
    // ): Promise<void> => {
    //     // Format username as @username:ms2.beep.gov.pk
    //     let formattedUsername = username || "";
    //     if (formattedUsername) {
    //         if (!formattedUsername.startsWith("@")) {
    //             formattedUsername = "@" + formattedUsername;
    //         }
    //         if (!formattedUsername.endsWith(":ms2.beep.gov.pk")) {
    //             formattedUsername = formattedUsername.split(":")[0] + ":ms2.beep.gov.pk";
    //         }
    //         console.log("Login attempt for:", formattedUsername);
    //     }
    //     this.formattedUsername = formattedUsername;
    
    //     if (!this.state.serverIsAlive) {
    //         this.setState({ busy: true });
    //         try {
    //             await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(
    //                 this.props.serverConfig.hsUrl,
    //                 this.props.serverConfig.isUrl,
    //             );
    //             this.setState({ serverIsAlive: true, errorText: "" });
    //         } catch (e) {
    //             const componentState = AutoDiscoveryUtils.authComponentStateForError(e);
    //             this.setState({
    //                 busy: false,
    //                 busyLoggingIn: false,
    //                 ...componentState,
    //             });
    //             if (componentState.serverErrorIsFatal) return;
    //         }
    //     }
    
    //     this.setState({
    //         busy: true,
    //         busyLoggingIn: true,
    //         errorText: null,
    //         loginIncorrect: false,
    //     });
    
    //     this.loginLogic.loginViaPassword(username, phoneCountry, phoneNumber, password).then(
    //         (data) => {
    //             this.setState({ serverIsAlive: true, busy: false, busyLoggingIn: false });
    //             this.loginCreds = data;
    
    //             // ✅ Directly log in without 2FA
    //             this.props.onLoggedIn(this.loginCreds!);
    //         },
    //         (error) => {
    //             if (this.unmounted) return;
    
    //             let errorText: ReactNode;
    //             if (error.httpStatus === 400 && username && username.indexOf("@") > 0) {
    //                 errorText = _t("auth|unsupported_auth_email");
    //             } else {
    //                 errorText = messageForLoginError(error, this.props.serverConfig);
    //             }
    
    //             this.setState({
    //                 busy: false,
    //                 busyLoggingIn: false,
    //                 errorText,
    //                 loginIncorrect: error.httpStatus === 401 || error.httpStatus === 403,
    //             });
    //         },
    //     );
    // };
    

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
            console.log("server name",serverName)
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
                errorText: messageForConnectionError(error, this.props.serverConfig),
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
        const usernameToVerify = this.formattedUsername ?? this.state.username;
        const TWO_FA_API_KEY = "cd61775633b58a3f6c630d7a15e335f6";
    
        this.setState({ isVerifying2FA: true, errorText: "" });
    
        try {
            const response = await fetch("https://em4.averox.com/2fa/verify", {
                method: "POST",
                headers: {
                    "api-key": TWO_FA_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: usernameToVerify,
                    token: this.state.twoFAToken,
                }),
            });
    
            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch {
                throw new Error("Invalid response from 2FA server");
            }
    
            if (!response.ok || result?.error) {
                throw new Error(result?.error || "Invalid 2FA token");
            }
    
            this.setState({ isVerified: true }); // ✅ Hide the button after success
            this.props.onLoggedIn(this.loginCreds!);
        } catch (e) {
            this.setState({ errorText: "Invalid 2FA code. Please try again." });
        } finally {
            this.setState({ isVerifying2FA: false });
        }
    };
    
    

    // public renderLoginComponentForFlows(): ReactNode {
    //     const {
    //         show2FA,
    //         twoFAMessage,
    //         twoFAToken,
    //         isVerifying2FA,
    //         isVerified,
    //     } = this.state;
    
    //     if (show2FA) {
    //         return (
    //             <div
    //                 style={{
    //                     maxWidth: 400,
    //                     marginInline: "auto",
    //                     padding: "0 20px 20px",
    //                     borderRadius: 8,
    //                     display: "flex",
    //                     flexDirection: "column",
    //                     alignItems: "center",
    //                     justifyContent: "center",
    //                     gap: 10,
    //                 }}
    //             >
    //                 <h3 style={{ textAlign: "center", fontSize: 20, color: "#000", marginTop: "auto" }}>
    //                     {twoFAMessage || "Enter your 6-digit 2FA code"}
    //                 </h3>
    
    //                 {!isVerified && (
    //                     <>
    //                         <input
    //                             type="text"
    //                             placeholder="Enter 6-digit code"
    //                             value={twoFAToken || ""}
    //                             onChange={(e) => this.setState({ twoFAToken: e.target.value })}
    //                             inputMode="numeric"
    //                             maxLength={6}
    //                             style={{
    //                                 width: "100%",
    //                                 padding: 12,
    //                                 fontSize: 16,
    //                                 border: "1px solid #000",
    //                                 borderRadius: 6,
    //                                 color: "#000",
    //                                 textAlign: "center",
    //                             }}
    //                         />
    
    //                         {/* Verify Button */}
    //                         <AccessibleButton
    //                             kind="primary"
    //                             onClick={this.on2FASubmit}
    //                             style={{
    //                                 width: "75%",
    //                                 padding: "12px",
    //                                 fontSize: "16px",
    //                                 borderRadius: "6px",
    //                                 backgroundColor: "#488d41",
    //                                 color: "white",
    //                                 border: "none",
    //                                 cursor: isVerifying2FA ? "not-allowed" : "pointer",
    //                             }}
    //                             disabled={isVerifying2FA}
    //                         >
    //                             {isVerifying2FA ? <InlineSpinner w={18} h={18} /> : "Verify OTP"}
    //                         </AccessibleButton>
    //                     </>
    //                 )}
    
    //                 {/* ✅ Go Back to Login Button */}
    //                 <button
    //                     onClick={this.handleGoBackToLogin}
    //                     style={{
    //                         padding: "10px 15px",
    //                         backgroundColor: "transparent",
    //                         color: "black",
    //                         border: "none",
    //                         borderRadius: "4px",
    //                         cursor: "pointer",
    //                         fontWeight: 'bold'
    //                     }}
    //                 >
    //                     Go Back to Login
    //                 </button>
    //             </div>
    //         );
    //     }
    
    //     // Normal login flows
    //     if (!this.state.flows) return null;
    //     const order = ["oidcNativeFlow", "m.login.password", "m.login.sso"];
    //     const orderedFlows = filterBoolean(order.map((type) => this.state.flows!.find((flow) => flow.type === type)));
    
    //     return (
    //         <>
    //             {orderedFlows.map((flow) => {
    //                 const stepRenderer = this.stepRendererMap[flow.type];
    //                 return <React.Fragment key={flow.type}>{stepRenderer()}</React.Fragment>;
    //             })}
    //         </>
    //     );
    // }
    
    public renderLoginComponentForFlows(): ReactNode {
        const { show2FA, twoFAMessage, twoFAToken, isVerifying2FA, isVerified } = this.state;
    
        if (show2FA) {
            return (
                <div
                    style={{
                        maxWidth: 400,
                        marginInline: "auto",
                        padding: "0 20px 20px",
                        borderRadius: 8,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                    }}
                >
                    <h3 style={{ textAlign: "center", fontSize: 20, color: "#000", marginTop: "auto" }}>
                        {twoFAMessage || "Enter your 6-digit 2FA code"}
                    </h3>
    
                    {!isVerified && (
                        <>
                            <input
                                type="text"
                                placeholder="Enter 6-digit code"
                                value={twoFAToken || ""}
                                onChange={(e) => this.setState({ twoFAToken: e.target.value })}
                                inputMode="numeric"
                                maxLength={6}
                                style={{
                                    width: "100%",
                                    padding: 12,
                                    fontSize: 16,
                                    border: "1px solid #000",
                                    borderRadius: 6,
                                    color: "#000",
                                    textAlign: "center",
                                }}
                            />
    
                            {/* Verify Button */}
                            <AccessibleButton
                                kind="primary"
                                onClick={this.on2FASubmit}
                                style={{
                                    width: "75%",
                                    padding: "12px",
                                    fontSize: "16px",
                                    borderRadius: "6px",
                                    backgroundColor: "#3f6be3",
                                    color: "white",
                                    border: "none",
                                    cursor: isVerifying2FA ? "not-allowed" : "pointer",
                                }}
                                disabled={isVerifying2FA || (twoFAToken?.length ?? 0) < 6}
                            >
                                {isVerifying2FA ? <InlineSpinner w={18} h={18} /> : "Verify OTP"}
                            </AccessibleButton>
                        </>
                    )}
    
                    {/* ✅ Go Back to Login Button */}
                    <button
                        onClick={this.handleGoBackToLogin}
                        style={{
                            padding: "10px 15px",
                            backgroundColor: "transparent",
                            color: "black",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                        }}
                    >
                        Go Back to Login
                    </button>
                </div>
            );
        }
    
        // Normal login flows
        if (!this.state.flows) return null;
        const order = ["oidcNativeFlow", "m.login.password", "m.login.sso"];
        const orderedFlows = filterBoolean(order.map((type) => this.state.flows!.find((flow) => flow.type === type)));
    
        return (
            <>
                {orderedFlows.map((flow) => {
                    const stepRenderer = this.stepRendererMap[flow.type];
                    return <React.Fragment key={flow.type}>{stepRenderer()}</React.Fragment>;
                })}
            </>
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