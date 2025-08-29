/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/


import React from "react";
import { type KeyBackupInfo, type VerificationRequest } from "matrix-js-sdk/src/crypto-api";
import { logger } from "matrix-js-sdk/src/logger";
import { type SecretStorageKeyDescription } from "matrix-js-sdk/src/secret-storage";
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Modal from "../../../Modal";
import VerificationRequestDialog from "../../views/dialogs/VerificationRequestDialog";
import { SetupEncryptionStore, Phase } from "../../../stores/SetupEncryptionStore";
import EncryptionPanel from "../../views/right_panel/EncryptionPanel";
import AccessibleButton, { type ButtonEvent } from "../../views/elements/AccessibleButton";
import Spinner from "../../views/elements/Spinner";

// Utility function to check if a key has a passphrase
function keyHasPassphrase(keyInfo: SecretStorageKeyDescription): boolean {
    return Boolean(keyInfo.passphrase && keyInfo.passphrase.salt && keyInfo.passphrase.iterations);
}

interface IProps {
    onFinished: () => void;
}

interface IState {
    phase?: Phase;
    verificationRequest: VerificationRequest | null;
    backupInfo: KeyBackupInfo | null;
    lostKeys: boolean;
}

export default class SetupEncryptionBody extends React.Component<IProps, IState> {
    private autoClicked = false;
    private doneAutoClicked = false; // New flag for Done phase

    public constructor(props: IProps) {
        super(props);
        const store = SetupEncryptionStore.sharedInstance();
        store.start();
        this.state = {
            phase: store.phase,
            verificationRequest: store.verificationRequest,
            backupInfo: store.backupInfo,
            lostKeys: store.lostKeys(),
        };
    }

    public componentDidMount(): void {
        const store = SetupEncryptionStore.sharedInstance();
        store.on("update", this.onStoreUpdate);
        this.checkAutoActions(store);
    }

    public componentWillUnmount(): void {
        const store = SetupEncryptionStore.sharedInstance();
        store.off("update", this.onStoreUpdate);
        store.stop();
    }

    private onStoreUpdate = (): void => {
        const store = SetupEncryptionStore.sharedInstance();
        if (store.phase === Phase.Finished) {
            this.props.onFinished();
            return;
        }
        this.setState({
            phase: store.phase,
            verificationRequest: store.verificationRequest,
            backupInfo: store.backupInfo,
            lostKeys: store.lostKeys(),
        }, () => {
            this.checkAutoActions(store);
        });
    };

    // 🔁 Triggers automated steps based on the current phase
    private checkAutoActions(store: SetupEncryptionStore): void {
        // Handle Intro phase auto-action
        if (!this.autoClicked && this.state.phase === Phase.Intro && store.keyInfo) {
            this.autoClicked = true;
            this.onUsePassphraseClick();
        }

        // Handle Done phase auto-action
        if (!this.doneAutoClicked && this.state.phase === Phase.Done) {
            this.doneAutoClicked = true;
            this.onDoneClick();
        }
    }

    private onUsePassphraseClick = async (): Promise<void> => {
        SetupEncryptionStore.sharedInstance().usePassPhrase();
    };

    private onVerifyClick = (): void => {
        const cli = MatrixClientPeg.safeGet();
        const userId = cli.getSafeUserId();
        const requestPromise = cli.getCrypto()!.requestOwnUserVerification();
        this.props.onFinished();
        Modal.createDialog(VerificationRequestDialog, {
            verificationRequestPromise: requestPromise,
            member: cli.getUser(userId) ?? undefined,
            onFinished: async (): Promise<void> => {
                const request = await requestPromise;
                request.cancel();
                this.props.onFinished();
            },
        });
    };

    private onSkipConfirmClick = (): void => {
        SetupEncryptionStore.sharedInstance().skipConfirm();
    };

    private onSkipBackClick = (): void => {
        SetupEncryptionStore.sharedInstance().returnAfterSkip();
    };

    private onResetClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        SetupEncryptionStore.sharedInstance().reset();
    };

    private onResetConfirmClick = (): void => {
        SetupEncryptionStore.sharedInstance().resetConfirm();
        this.props.onFinished();
    };

    private onResetBackClick = (): void => {
        SetupEncryptionStore.sharedInstance().returnAfterReset();
    };

    private onDoneClick = (): void => {
        logger.log("Auto-triggering Done button");
        SetupEncryptionStore.sharedInstance().done();
        this.props.onFinished(); 
    };

    private onEncryptionPanelClose = (): void => {
        this.props.onFinished();
    };

    public render(): React.ReactNode {
        const cli = MatrixClientPeg.safeGet();
        const { phase, lostKeys, verificationRequest, backupInfo } = this.state;
        const store = SetupEncryptionStore.sharedInstance();
        
        if (verificationRequest && cli.getUser(verificationRequest.otherUserId)) {
            return (
                <EncryptionPanel
                    layout="dialog"
                    verificationRequest={verificationRequest}
                    onClose={this.onEncryptionPanelClose}
                    member={cli.getUser(verificationRequest.otherUserId)!}
                    isRoomEncrypted={false}
                />
            );
        }

        switch (phase) {
            case Phase.Intro:
                if (lostKeys) {
                    return (
                        <div>
                            <p>{_t("encryption|verification|no_key_or_device")}</p>
                            <div className="mx_CompleteSecurity_actionRow">
                                <AccessibleButton kind="primary" onClick={this.onResetConfirmClick}>
                                    {_t("encryption|verification|reset_proceed_prompt")}
                                </AccessibleButton>
                            </div>
                        </div>
                    );
                } else {
                    const keyInfo = store.keyInfo;
                    const hasPassphrase = keyInfo && keyHasPassphrase(keyInfo);
                    const recoveryKeyPrompt = keyInfo
                        ? hasPassphrase
                            ? _t("encryption|verification|verify_using_key_or_phrase")
                            : _t("encryption|verification|verify_using_key")
                        : null;
                    return (
                        <div>
                            <p>{_t("encryption|verification|verification_description")}</p>
                            <div className="mx_CompleteSecurity_actionRow">
                                {/* {store.hasDevicesToVerifyAgainst && (
                                    <AccessibleButton kind="primary" onClick={this.onVerifyClick}>
                                        {_t("encryption|verification|verify_using_device")}
                                    </AccessibleButton>
                                )} */}
                                {recoveryKeyPrompt && (
                                    <AccessibleButton kind="primary" onClick={this.onUsePassphraseClick}>
                                        {recoveryKeyPrompt}
                                    </AccessibleButton>
                                )}
                            </div>
                            <div className="mx_SetupEncryptionBody_reset">
                                {_t("encryption|reset_all_button", undefined, {
                                    a: (sub) => (
                                        <AccessibleButton
                                            kind="link_inline"
                                            className="mx_SetupEncryptionBody_reset_link"
                                            onClick={this.onResetClick}
                                        >
                                            {sub}
                                        </AccessibleButton>
                                    ),
                                })}
                            </div>
                        </div>
                    );
                }
            case Phase.Done:
                return (
                    <div>
                        <div className="mx_CompleteSecurity_heroIcon mx_E2EIcon_verified" />
                        <p>
                            {backupInfo
                                ? _t("encryption|verification|verification_success_with_backup")
                                : _t("encryption|verification|verification_success_without_backup")}
                        </p>
                        <div className="mx_CompleteSecurity_actionRow">
                            <AccessibleButton kind="primary" onClick={this.onDoneClick}>
                                {_t("action|done")}
                            </AccessibleButton>
                        </div>
                    </div>
                );
            case Phase.ConfirmSkip:
                return (
                    <div>
                        <p>{_t("encryption|verification|verification_skip_warning")}</p>
                        <div className="mx_CompleteSecurity_actionRow">
                            <AccessibleButton kind="danger_outline" onClick={this.onSkipConfirmClick}>
                                {_t("encryption|verification|verify_later")}
                            </AccessibleButton>
                            <AccessibleButton kind="primary" onClick={this.onSkipBackClick}>
                                {_t("action|go_back")}
                            </AccessibleButton>
                        </div>
                    </div>
                );
            case Phase.ConfirmReset:
                return (
                    <div>
                        <p>{_t("encryption|verification|verify_reset_warning_1")}</p>
                        <p>{_t("encryption|verification|verify_reset_warning_2")}</p>
                        <div className="mx_CompleteSecurity_actionRow">
                            <AccessibleButton kind="danger_outline" onClick={this.onResetConfirmClick}>
                                {_t("encryption|verification|reset_proceed_prompt")}
                            </AccessibleButton>
                            <AccessibleButton kind="primary" onClick={this.onResetBackClick}>
                                {_t("action|go_back")}
                            </AccessibleButton>
                        </div>
                    </div>
                );
            case Phase.Busy:
            case Phase.Loading:
                return <Spinner />;
            default:
                logger.log(`SetupEncryptionBody: Unknown phase ${phase}`);
                return null;
        }
    }
}

