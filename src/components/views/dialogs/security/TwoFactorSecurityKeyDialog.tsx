/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, type FormEvent } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { decodeRecoveryKey } from "matrix-js-sdk/src/crypto-api";
import { type SecretStorage } from "matrix-js-sdk/src/matrix";

import Field from "../../elements/Field";
import AccessibleButton from "../../elements/AccessibleButton";
import { _t } from "../../../../languageHandler";
import DialogButtons from "../../elements/DialogButtons";
import BaseDialog from "../BaseDialog";

export type TwoFactorKeyParams = { passphrase?: string; recoveryKey?: string };

interface IProps {
    keyInfo: SecretStorage.SecretStorageKeyDescription;
    checkPrivateKey: (k: TwoFactorKeyParams) => Promise<boolean>;
    onFinished(result?: false | TwoFactorKeyParams): void;
}

interface IState {
    recoveryKey: string;
    recoveryKeyValid: boolean | null;
    passPhrase: string;
    keyMatches: boolean | null;
    usePassphrase: boolean;
}

export default class TwoFactorSecurityKeyDialog extends React.PureComponent<IProps, IState> {
    private inputRef = React.createRef<HTMLInputElement>();

    public constructor(props: IProps) {
        super(props);
        this.state = {
            recoveryKey: "",
            recoveryKeyValid: null,
            passPhrase: "",
            keyMatches: null,
            usePassphrase: true,
        };
    }

    private onPassPhraseChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        this.setState({ passPhrase: ev.target.value, keyMatches: null });
    };

    private onRecoveryKeyChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        const value = ev.target.value;
        this.setState({ recoveryKey: value, recoveryKeyValid: null, keyMatches: null });

        // Validate the recovery key format
        try {
            if (value.trim().length > 0) {
                decodeRecoveryKey(value.trim());
                this.setState({ recoveryKeyValid: true });
            }
        } catch {
            this.setState({ recoveryKeyValid: false });
        }
    };

    private onPassPhraseSubmit = async (ev: FormEvent<HTMLFormElement> | React.MouseEvent): Promise<void> => {
        ev.preventDefault();
        if (this.state.passPhrase.length <= 0) {
            this.inputRef.current?.focus();
            return;
        }

        this.setState({ keyMatches: null });
        const input = { passphrase: this.state.passPhrase };
        const keyMatches = await this.props.checkPrivateKey(input);
        if (keyMatches) {
            this.props.onFinished(input);
        } else {
            this.setState({ keyMatches: false });
            this.inputRef.current?.focus();
        }
    };

    private onRecoveryKeySubmit = async (ev: FormEvent<HTMLFormElement> | React.MouseEvent): Promise<void> => {
        ev.preventDefault();
        if (this.state.recoveryKey.trim().length === 0) {
            return;
        }

        this.setState({ keyMatches: null });
        const input = { recoveryKey: this.state.recoveryKey.trim() };
        const keyMatches = await this.props.checkPrivateKey(input);

        if (keyMatches) {
            this.props.onFinished(input);
        } else {
            this.setState({ keyMatches: false });
        }
    };

    private onUseRecoveryKeyClick = (): void => {
        this.setState({ usePassphrase: false });
    };

    private onUsePassphraseClick = (): void => {
        this.setState({ usePassphrase: true });
    };

    public render(): React.ReactNode {
        const hasPassphrase = this.props.keyInfo?.passphrase?.salt && this.props.keyInfo?.passphrase?.iterations;

        let content: React.ReactNode;
        let title: string;

        if (this.state.usePassphrase && hasPassphrase) {
            title = _t("encryption|access_secret_storage_dialog|security_phrase_title");

            const keyStatus =
                this.state.keyMatches === false ? (
                    <div className="mx_AccessSecretStorageDialog_keyStatus" style={{ color: "red", marginTop: "8px" }}>
                        {_t("encryption|access_secret_storage_dialog|security_phrase_incorrect_error")}
                    </div>
                ) : (
                    <div className="mx_AccessSecretStorageDialog_keyStatus" />
                );

            content = (
                <div>
                    <p>
                        {_t(
                            "encryption|access_secret_storage_dialog|enter_phrase_or_key_prompt",
                            {},
                            {
                                button: (s) => (
                                    <AccessibleButton kind="link_inline" onClick={this.onUseRecoveryKeyClick}>
                                        {s}
                                    </AccessibleButton>
                                ),
                            },
                        )}
                    </p>

                    <form className="mx_AccessSecretStorageDialog_primaryContainer" onSubmit={this.onPassPhraseSubmit}>
                        <Field
                            inputRef={this.inputRef}
                            id="mx_passPhraseInput"
                            className="mx_AccessSecretStorageDialog_passPhraseInput"
                            type="password"
                            label={_t("encryption|access_secret_storage_dialog|security_phrase_title")}
                            value={this.state.passPhrase}
                            onChange={this.onPassPhraseChange}
                            autoFocus={true}
                            autoComplete="new-password"
                        />
                        {keyStatus}
                        <DialogButtons
                            primaryButton={_t("action|continue")}
                            onPrimaryButtonClick={this.onPassPhraseSubmit}
                            hasCancel={true}
                            onCancel={() => this.props.onFinished(false)}
                            focus={false}
                        />
                    </form>
                </div>
            );
        } else {
            title = _t("encryption|access_secret_storage_dialog|security_key_title");

            const keyStatus =
                this.state.keyMatches === false ? (
                    <div style={{ color: "red", marginTop: "8px" }}>
                        {_t("encryption|access_secret_storage_dialog|key_validation_text|wrong_security_key")}
                    </div>
                ) : this.state.recoveryKeyValid === false ? (
                    <div style={{ color: "red", marginTop: "8px" }}>
                        {_t("encryption|access_secret_storage_dialog|key_validation_text|invalid_security_key")}
                    </div>
                ) : (
                    <div />
                );

            content = (
                <div>
                    <p>{_t("encryption|access_secret_storage_dialog|use_security_key_prompt")}</p>
                    {hasPassphrase && (
                        <p>
                            <AccessibleButton kind="link_inline" onClick={this.onUsePassphraseClick}>
                                Use security phrase instead
                            </AccessibleButton>
                        </p>
                    )}

                    <form
                        className="mx_AccessSecretStorageDialog_primaryContainer"
                        onSubmit={this.onRecoveryKeySubmit}
                        spellCheck={false}
                        autoComplete="off"
                    >
                        <Field
                            type="password"
                            id="mx_securityKey"
                            label={_t("encryption|access_secret_storage_dialog|security_key_title")}
                            value={this.state.recoveryKey}
                            onChange={this.onRecoveryKeyChange}
                            autoFocus={true}
                            forceValidity={this.state.recoveryKeyValid ?? undefined}
                            autoComplete="off"
                        />
                        {keyStatus}
                        <DialogButtons
                            primaryButton={_t("action|continue")}
                            onPrimaryButtonClick={this.onRecoveryKeySubmit}
                            hasCancel={true}
                            onCancel={() => this.props.onFinished(false)}
                            focus={false}
                        />
                    </form>
                </div>
            );
        }

        return (
            <BaseDialog
                className="mx_AccessSecretStorageDialog"
                onFinished={() => this.props.onFinished(false)}
                title={title}
            >
                <div>{content}</div>
            </BaseDialog>
        );
    }
}
