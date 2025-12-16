/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useRef, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import {
    type IRequestMsisdnTokenResponse,
    type IRequestTokenResponse,
    MatrixError,
    ThreepidMedium,
} from "matrix-js-sdk/src/matrix";

import AddThreepid, { type Binding, type ThirdPartyIdentifier } from "../../../AddThreepid";
import { _t, UserFriendlyError } from "../../../languageHandler";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import Modal from "../../../Modal";
import ErrorDialog, { extractErrorMessageFromError } from "../dialogs/ErrorDialog";
import Field from "../elements/Field";
import { looksValid as emailLooksValid } from "../../../email";
import CountryDropdown from "../auth/CountryDropdown";
import { type PhoneNumberCountryDefinition } from "../../../phonenumber";
import InlineSpinner from "../elements/InlineSpinner";

// Whether we're adding 3pids to the user's account on the homeserver or sharing them on an identity server
type TheepidControlMode = "hs" | "is";

/**
 * Maps backend error messages and codes to user-friendly custom messages for 3pid operations
 */
function getCustomThreepidErrorMessage(err: any, medium: "email" | "msisdn"): string {
    // Check if it's a MatrixError with an errcode
    if (err instanceof MatrixError && err.errcode) {
        switch (err.errcode) {
            case "M_THREEPID_IN_USE":
                return medium === "email"
                    ? _t("settings|general|error_email_already_in_use")
                    : _t("settings|general|error_msisdn_already_in_use");
            case "M_INVALID_EMAIL":
                return _t("settings|general|error_invalid_email_detail");
            case "M_INVALID_PARAM":
                return _t("settings|general|error_invalid_email_detail");
            case "M_LIMIT_EXCEEDED":
                return _t("settings|general|error_rate_limit");
            case "M_RESOURCE_LIMIT_EXCEEDED":
                return _t("error|resource_limits");
            case "M_FORBIDDEN":
                return _t("settings|general|error_add_email_forbidden");
        }
    }

    // Check error message patterns
    const errorMsg = err?.message || err?.error || err?.toString() || "";
    const errorLower = errorMsg.toLowerCase();
    
    if (errorLower.includes("already in use") || errorLower.includes("already exists")) {
        return medium === "email"
            ? _t("settings|general|error_email_already_in_use")
            : _t("settings|general|error_msisdn_already_in_use");
    }

    if (errorLower.includes("invalid") && medium === "email") {
        return _t("settings|general|error_invalid_email_detail");
    }

    if (errorLower.includes("rate limit") || errorLower.includes("too many")) {
        return _t("settings|general|error_rate_limit");
    }

    if (errorLower.includes("network") || errorLower.includes("connection") || errorLower.includes("timeout")) {
        return _t("error|connection");
    }

    // Use extractErrorMessageFromError as fallback
    return extractErrorMessageFromError(err, _t("settings|general|error_add_email_generic"));
}

interface ExistingThreepidProps {
    mode: TheepidControlMode;
    threepid: ThirdPartyIdentifier;
    onChange: (threepid: ThirdPartyIdentifier) => void;
    disabled?: boolean;
}

const ExistingThreepid: React.FC<ExistingThreepidProps> = ({ mode, threepid, onChange, disabled }) => {
    const [isConfirming, setIsConfirming] = useState(false);
    const client = useMatrixClientContext();
    const bindTask = useRef<AddThreepid | undefined>();

    const [isVerifyingBind, setIsVerifyingBind] = useState(false);
    const [continueDisabled, setContinueDisabled] = useState(false);
    const [verificationCode, setVerificationCode] = useState("");

    const onRemoveClick = useCallback((e: ButtonEvent) => {
        e.stopPropagation();
        e.preventDefault();

        setIsConfirming(true);
    }, []);

    const onCancelClick = useCallback((e: ButtonEvent) => {
        e.stopPropagation();
        e.preventDefault();

        setIsConfirming(false);
    }, []);

    const onConfirmRemoveClick = useCallback(
        (e: ButtonEvent) => {
            e.stopPropagation();
            e.preventDefault();

            client
                .deleteThreePid(threepid.medium, threepid.address)
                .then(() => {
                    return onChange(threepid);
                })
                .catch((err) => {
                    logger.error("Unable to remove contact information: " + err);
                    Modal.createDialog(ErrorDialog, {
                        title: _t("settings|general|error_remove_3pid"),
                        description: err?.message ?? _t("invite|failed_generic"),
                    });
                });
        },
        [client, threepid, onChange],
    );

    const changeBinding = useCallback(
        async ({ bind, label, errorTitle }: Binding) => {
            try {
                if (bind) {
                    bindTask.current = new AddThreepid(client);
                    setContinueDisabled(true);
                    if (threepid.medium === ThreepidMedium.Email) {
                        await bindTask.current.bindEmailAddress(threepid.address);
                    } else {
                        // XXX: Sydent will accept a number without country code if you add
                        // a leading plus sign to a number in E.164 format (which the 3PID
                        // address is), but this goes against the spec.
                        // See https://github.com/matrix-org/matrix-doc/issues/2222
                        await bindTask.current.bindMsisdn(null as unknown as string, `+${threepid.address}`);
                    }
                    setContinueDisabled(false);
                    setIsVerifyingBind(true);
                } else {
                    await client.unbindThreePid(threepid.medium, threepid.address);
                    onChange(threepid);
                }
            } catch (err) {
                logger.error(`changeBinding: Unable to ${label} email address ${threepid.address}`, err);
                setIsVerifyingBind(false);
                setContinueDisabled(false);
                bindTask.current = undefined;
                Modal.createDialog(ErrorDialog, {
                    title: errorTitle,
                    description: extractErrorMessageFromError(err, _t("invite|failed_generic")),
                });
            }
        },
        [client, threepid, onChange],
    );

    const onRevokeClick = useCallback(
        (e: ButtonEvent): void => {
            e.stopPropagation();
            e.preventDefault();
            changeBinding({
                bind: false,
                label: "revoke",
                errorTitle:
                    threepid.medium === "email"
                        ? _t("settings|general|error_revoke_email_discovery")
                        : _t("settings|general|error_revoke_msisdn_discovery"),
            }).then();
        },
        [changeBinding, threepid.medium],
    );

    const onShareClick = useCallback(
        (e: ButtonEvent): void => {
            e.stopPropagation();
            e.preventDefault();
            changeBinding({
                bind: true,
                label: "share",
                errorTitle:
                    threepid.medium === "email"
                        ? _t("settings|general|error_share_email_discovery")
                        : _t("settings|general|error_share_msisdn_discovery"),
            }).then();
        },
        [changeBinding, threepid.medium],
    );

    const onContinueClick = useCallback(
        async (e: ButtonEvent) => {
            e.stopPropagation();
            e.preventDefault();

            setContinueDisabled(true);
            try {
                if (threepid.medium === ThreepidMedium.Email) {
                    await bindTask.current?.checkEmailLinkClicked();
                } else {
                    await bindTask.current?.haveMsisdnToken(verificationCode);
                }
                setIsVerifyingBind(false);
                onChange(threepid);
                bindTask.current = undefined;
            } catch (err) {
                logger.error(`Unable to verify threepid:`, err);
                // Debug log to help identify the error format
                logger.log("Error details:", {
                    err,
                    errType: err?.constructor?.name,
                    errMessage: (err as any)?.message,
                    errHttpStatus: (err as any)?.httpStatus,
                    errErrcode: (err as any)?.errcode,
                    errToString: (err as any)?.toString(),
                });

                let underlyingError = err;
                if (err instanceof UserFriendlyError) {
                    underlyingError = err.cause;
                    logger.log("Underlying error:", underlyingError);
                }

                // Get error message from various possible locations
                const errorMsg = 
                    (underlyingError as any)?.message || 
                    (err as any)?.message || 
                    (underlyingError as any)?.toString() || 
                    (err as any)?.toString() || 
                    "";
                const errorMsgLower = errorMsg.toLowerCase();
                logger.log("Error message extracted:", errorMsg);

                // Check for HTTP 400 - indicates "No validated 3pid session found"
                // Check multiple ways to detect the error
                const errHttpStatus = 
                    (underlyingError as any)?.httpStatus ?? 
                    (err as any)?.httpStatus ?? 
                    (underlyingError instanceof MatrixError ? underlyingError.httpStatus : undefined) ??
                    (err instanceof MatrixError ? err.httpStatus : undefined);
                
                const isHttp400 = errHttpStatus === 400;
                
                // Check for the specific error in multiple ways
                const isNoValidatedSessionError = 
                    errorMsgLower.includes("no validated 3pid session found") ||
                    errorMsgLower.includes("no validated") ||
                    errorMsgLower.includes("validated 3pid session") ||
                    (isHttp400 && (errorMsgLower.includes("validated") || errorMsgLower.includes("3pid session") || errorMsgLower.includes("session found"))) ||
                    (underlyingError instanceof MatrixError && 
                     underlyingError.httpStatus === 400 &&
                     (errorMsgLower.includes("validated") || errorMsgLower.includes("3pid session"))) ||
                    (err instanceof MatrixError && 
                     err.httpStatus === 400 &&
                     (errorMsgLower.includes("validated") || errorMsgLower.includes("3pid session")));
                
                logger.log("Error detection:", { isHttp400, isNoValidatedSessionError, errorMsgLower });

                // Check if it's the "No validated 3pid session found" error - show user-friendly message
                if (isNoValidatedSessionError) {
                    Modal.createDialog(ErrorDialog, {
                        title:
                            threepid.medium === "email"
                                ? _t("settings|general|email_not_verified")
                                : _t("settings|general|error_msisdn_verification"),
                        description:
                            threepid.medium === "email"
                                ? _t("settings|general|email_verification_instructions")
                                : _t("settings|general|msisdn_verification_instructions"),
                    });
                } else if (underlyingError instanceof MatrixError && underlyingError.errcode === "M_THREEPID_AUTH_FAILED") {
                    Modal.createDialog(ErrorDialog, {
                        title:
                            threepid.medium === "email"
                                ? _t("settings|general|email_not_verified")
                                : _t("settings|general|error_msisdn_verification"),
                        description:
                            threepid.medium === "email"
                                ? _t("settings|general|email_verification_instructions")
                                : extractErrorMessageFromError(err, _t("invite|failed_generic")),
                    });
                } else {
                    logger.error("Unable to verify email address: " + err);
                    Modal.createDialog(ErrorDialog, {
                        title: _t("settings|general|error_email_verification"),
                        description: extractErrorMessageFromError(err, _t("invite|failed_generic")),
                    });
                }
            } finally {
                setContinueDisabled(false);
            }
        },
        [verificationCode, onChange, threepid],
    );

    const onVerificationCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setVerificationCode(e.target.value);
    }, []);

    if (isConfirming) {
        return (
            <div className="mx_AddRemoveThreepids_existing">
                <span className="mx_AddRemoveThreepids_existing_promptText">
                    {threepid.medium === ThreepidMedium.Email
                        ? _t("settings|general|remove_email_prompt", { email: threepid.address })
                        : _t("settings|general|remove_msisdn_prompt", { phone: threepid.address })}
                </span>
                <AccessibleButton
                    onClick={onConfirmRemoveClick}
                    kind="danger_sm"
                    className="mx_AddRemoveThreepids_existing_button"
                >
                    {_t("action|remove")}
                </AccessibleButton>
                <AccessibleButton
                    onClick={onCancelClick}
                    kind="link_sm"
                    className="mx_AddRemoveThreepids_existing_button"
                >
                    {_t("action|cancel")}
                </AccessibleButton>
            </div>
        );
    }

    if (isVerifyingBind) {
        if (threepid.medium === ThreepidMedium.Email) {
            return (
                <div className="mx_EmailAddressesPhoneNumbers_verify">
                    <span className="mx_EmailAddressesPhoneNumbers_verify_instructions">
                        {_t("settings|general|discovery_email_verification_instructions")}
                    </span>
                    <AccessibleButton
                        className="mx_EmailAddressesPhoneNumbers_existing_button"
                        kind="primary_sm"
                        onClick={onContinueClick}
                        disabled={continueDisabled}
                    >
                        {_t("action|complete")}
                    </AccessibleButton>
                </div>
            );
        } else {
            return (
                <div className="mx_EmailAddressesPhoneNumbers_verify">
                    <span className="mx_EmailAddressesPhoneNumbers_verify_instructions">
                        {_t("settings|general|msisdn_verification_instructions")}
                    </span>
                    <form onSubmit={onContinueClick} autoComplete="off" noValidate={true}>
                        <Field
                            type="text"
                            label={_t("settings|general|msisdn_verification_field_label")}
                            autoComplete="off"
                            disabled={continueDisabled}
                            value={verificationCode}
                            onChange={onVerificationCodeChange}
                        />
                    </form>
                </div>
            );
        }
    }

    return (
        <div className="mx_AddRemoveThreepids_existing">
            <span className="mx_AddRemoveThreepids_existing_address">{threepid.address}</span>
            <AccessibleButton
                onClick={mode === "hs" ? onRemoveClick : threepid.bound ? onRevokeClick : onShareClick}
                kind={mode === "hs" || threepid.bound ? "danger_sm" : "primary_sm"}
                disabled={disabled}
            >
                {mode === "hs" ? _t("action|remove") : threepid.bound ? _t("action|revoke") : _t("action|share")}
            </AccessibleButton>
        </div>
    );
};

function isMsisdnResponse(
    resp: IRequestTokenResponse | IRequestMsisdnTokenResponse,
): resp is IRequestMsisdnTokenResponse {
    return (resp as IRequestMsisdnTokenResponse).msisdn !== undefined;
}

const AddThreepidSection: React.FC<{ medium: "email" | "msisdn"; disabled?: boolean; onChange: () => void }> = ({
    medium,
    disabled,
    onChange,
}) => {
    const addTask = useRef<AddThreepid | undefined>();
    const [newThreepidInput, setNewThreepidInput] = useState("");
    const [phoneCountryInput, setPhoneCountryInput] = useState("");
    const [verificationCodeInput, setVerificationCodeInput] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [continueDisabled, setContinueDisabled] = useState(false);
    const [sentToMsisdn, setSentToMsisdn] = useState("");

    const client = useMatrixClientContext();

    const onPhoneCountryChanged = useCallback((country: PhoneNumberCountryDefinition) => {
        setPhoneCountryInput(country.iso2);
    }, []);

    const onContinueClick = useCallback(
        (e: ButtonEvent) => {
            e.stopPropagation();
            e.preventDefault();

            if (!addTask.current) return;

            setContinueDisabled(true);

            const checkPromise =
                medium === "email"
                    ? addTask.current?.checkEmailLinkClicked()
                    : addTask.current?.haveMsisdnToken(verificationCodeInput);
            checkPromise
                .then(([finished]) => {
                    if (finished) {
                        addTask.current = undefined;
                        setIsVerifying(false);
                        setNewThreepidInput("");
                        onChange();
                    }
                    setContinueDisabled(false);
                })
                .catch((err) => {
                    logger.error("Unable to verify 3pid: ", err);

                    setContinueDisabled(false);

                    let underlyingError = err;
                    if (err instanceof UserFriendlyError) {
                        underlyingError = err.cause;
                    }

                    // Get error message from various possible locations
                    const errorMsg = 
                        (underlyingError as any)?.message || 
                        (err as any)?.message || 
                        (underlyingError as any)?.toString() || 
                        (err as any)?.toString() || 
                        "";
                    const errorMsgLower = errorMsg.toLowerCase();

                    // Check for HTTP 400 - indicates "No validated 3pid session found"
                    // Also check MatrixError properties directly
                    const isHttp400 = 
                        (underlyingError as any)?.httpStatus === 400 ||
                        (err as any)?.httpStatus === 400 ||
                        (underlyingError instanceof MatrixError && underlyingError.httpStatus === 400) ||
                        (err instanceof MatrixError && err.httpStatus === 400);
                    
                    const isNoValidatedSessionError = 
                        errorMsgLower.includes("no validated 3pid session found") ||
                        errorMsgLower.includes("no validated") ||
                        (isHttp400 && (errorMsgLower.includes("validated") || errorMsgLower.includes("3pid session"))) ||
                        (underlyingError instanceof MatrixError && 
                         underlyingError.httpStatus === 400 &&
                         (errorMsgLower.includes("validated") || errorMsgLower.includes("3pid session"))) ||
                        (err instanceof MatrixError && 
                         err.httpStatus === 400 &&
                         (errorMsgLower.includes("validated") || errorMsgLower.includes("3pid session")));

                    // Check if it's the "No validated 3pid session found" error - show user-friendly message
                    if (isNoValidatedSessionError) {
                        Modal.createDialog(ErrorDialog, {
                            title:
                                medium === "email"
                                    ? _t("settings|general|email_not_verified")
                                    : _t("settings|general|error_msisdn_verification"),
                            description:
                                medium === "email"
                                    ? _t("settings|general|email_verification_instructions")
                                    : _t("settings|general|msisdn_verification_instructions"),
                        });
                    } else if (
                        underlyingError instanceof MatrixError &&
                        underlyingError.errcode === "M_THREEPID_AUTH_FAILED"
                    ) {
                        Modal.createDialog(ErrorDialog, {
                            title:
                                medium === "email"
                                    ? _t("settings|general|email_not_verified")
                                    : _t("settings|general|error_msisdn_verification"),
                            description: _t("settings|general|email_verification_instructions"),
                        });
                    } else {
                        Modal.createDialog(ErrorDialog, {
                            title:
                                medium === "email"
                                    ? _t("settings|general|error_email_verification")
                                    : _t("settings|general|error_msisdn_verification"),
                            description: extractErrorMessageFromError(err, _t("invite|failed_generic")),
                        });
                    }
                });
        },
        [onChange, medium, verificationCodeInput],
    );

    const onNewThreepidInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setNewThreepidInput(e.target.value);
    }, []);

    const onAddClick = useCallback(
        (e: React.FormEvent) => {
            e.stopPropagation();
            e.preventDefault();

            if (!newThreepidInput) return;

            // TODO: Inline field validation
            if (medium === "email" && !emailLooksValid(newThreepidInput)) {
                Modal.createDialog(ErrorDialog, {
                    title: _t("settings|general|error_invalid_email"),
                    description: _t("settings|general|error_invalid_email_detail"),
                });
                return;
            }

            addTask.current = new AddThreepid(client);
            setIsVerifying(true);
            setContinueDisabled(true);

            const addPromise =
                medium === "email"
                    ? addTask.current.addEmailAddress(newThreepidInput)
                    : addTask.current.addMsisdn(phoneCountryInput, newThreepidInput);

            addPromise
                .then((resp: IRequestTokenResponse | IRequestMsisdnTokenResponse) => {
                    setContinueDisabled(false);
                    if (isMsisdnResponse(resp)) {
                        setSentToMsisdn(resp.msisdn);
                    }
                })
                .catch((err) => {
                    logger.error(`Unable to add threepid ${newThreepidInput}`, err);
                    setIsVerifying(false);
                    setContinueDisabled(false);
                    addTask.current = undefined;

                    let underlyingError = err;
                    if (err instanceof UserFriendlyError) {
                        underlyingError = err.cause;
                    }

                    // Get error message from various possible locations
                    const errorMsg = 
                        (underlyingError as any)?.message || 
                        (err as any)?.message || 
                        (underlyingError as any)?.toString() || 
                        (err as any)?.toString() || 
                        "";
                    const errorMsgLower = errorMsg.toLowerCase();

                    // Check for HTTP 400 - indicates "No validated 3pid session found"
                    // Also check MatrixError properties directly
                    const isHttp400 = 
                        (underlyingError as any)?.httpStatus === 400 ||
                        (err as any)?.httpStatus === 400 ||
                        (underlyingError instanceof MatrixError && underlyingError.httpStatus === 400) ||
                        (err instanceof MatrixError && err.httpStatus === 400);
                    
                    const isNoValidatedSessionError = 
                        errorMsgLower.includes("no validated 3pid session found") ||
                        errorMsgLower.includes("no validated") ||
                        (isHttp400 && (errorMsgLower.includes("validated") || errorMsgLower.includes("3pid session"))) ||
                        (underlyingError instanceof MatrixError && 
                         underlyingError.httpStatus === 400 &&
                         (errorMsgLower.includes("validated") || errorMsgLower.includes("3pid session"))) ||
                        (err instanceof MatrixError && 
                         err.httpStatus === 400 &&
                         (errorMsgLower.includes("validated") || errorMsgLower.includes("3pid session")));

                    // Check if it's the "No validated 3pid session found" error - show user-friendly message
                    if (isNoValidatedSessionError) {
                        Modal.createDialog(ErrorDialog, {
                            title:
                                medium === "email"
                                    ? _t("settings|general|email_not_verified")
                                    : _t("settings|general|error_msisdn_verification"),
                            description:
                                medium === "email"
                                    ? _t("settings|general|email_verification_instructions")
                                    : _t("settings|general|msisdn_verification_instructions"),
                        });
                    } else {
                        // Use getCustomThreepidErrorMessage for other errors
                        const customErrorMsg = getCustomThreepidErrorMessage(err, medium);
                    Modal.createDialog(ErrorDialog, {
                        title: medium === "email" ? _t("settings|general|error_add_email") : _t("common|error"),
                            description: customErrorMsg,
                    });
                    }
                });
        },
        [client, phoneCountryInput, newThreepidInput, medium],
    );

    const onVerificationCodeInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setVerificationCodeInput(e.target.value);
    }, []);

    if (isVerifying && medium === "email") {
        return (
            <div>
                <div>{_t("settings|general|add_email_instructions")}</div>
                <AccessibleButton onClick={onContinueClick} kind="primary" disabled={continueDisabled}>
                    {_t("action|continue")}
                </AccessibleButton>
            </div>
        );
    } else if (isVerifying) {
        return (
            <div>
                <div>
                    {_t("settings|general|add_msisdn_instructions", { msisdn: sentToMsisdn })}
                    <br />
                </div>
                <form onSubmit={onContinueClick} autoComplete="off" noValidate={true}>
                    <Field
                        type="text"
                        label={_t("settings|general|msisdn_verification_field_label")}
                        autoComplete="off"
                        disabled={disabled || continueDisabled}
                        value={verificationCodeInput}
                        onChange={onVerificationCodeInputChange}
                    />
                    <AccessibleButton
                        onClick={onContinueClick}
                        kind="primary"
                        disabled={disabled || continueDisabled || verificationCodeInput.length === 0}
                    >
                        {_t("action|continue")}
                    </AccessibleButton>
                </form>
            </div>
        );
    }

    const phoneCountry =
        medium === "msisdn" ? (
            <CountryDropdown
                onOptionChange={onPhoneCountryChanged}
                className="mx_PhoneNumbers_country"
                value={phoneCountryInput}
                disabled={isVerifying}
                isSmall={true}
                showPrefix={true}
            />
        ) : undefined;

    return (
        <form onSubmit={onAddClick} autoComplete="off" noValidate={true}>
            <Field
                type="text"
                label={
                    medium === "email"
                        ? _t("settings|general|email_address_label")
                        : _t("settings|general|msisdn_label")
                }
                autoComplete={medium === "email" ? "email" : "tel-national"}
                disabled={disabled || isVerifying}
                value={newThreepidInput}
                onChange={onNewThreepidInputChange}
                prefixComponent={phoneCountry}
            />
            <AccessibleButton onClick={onAddClick} kind="primary" disabled={disabled}>
                {_t("action|add")}
            </AccessibleButton>
        </form>
    );
};

interface AddRemoveThreepidsProps {
    // Whether the control is for adding 3pids to the user's homeserver account or sharing them on an IS
    mode: TheepidControlMode;
    // Whether the control is for emails or phone numbers
    medium: ThreepidMedium;
    // The current list of third party identifiers
    threepids: ThirdPartyIdentifier[];
    // If true, the component is disabled and no third party identifiers can be added or removed
    disabled?: boolean;
    // Called when changes are made to the list of third party identifiers
    onChange: () => void;
    // If true, a spinner is shown instead of the component
    isLoading: boolean;
}

export const AddRemoveThreepids: React.FC<AddRemoveThreepidsProps> = ({
    mode,
    medium,
    threepids,
    disabled,
    onChange,
    isLoading,
}) => {
    if (isLoading) {
        return <InlineSpinner />;
    }

    const existingEmailElements = threepids.map((e) => {
        return <ExistingThreepid mode={mode} threepid={e} onChange={onChange} key={e.address} disabled={disabled} />;
    });

    return (
        <>
            {existingEmailElements}
            {mode === "hs" && <AddThreepidSection medium={medium} disabled={disabled} onChange={onChange} />}
        </>
    );
};
