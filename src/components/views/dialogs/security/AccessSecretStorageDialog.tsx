/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { debounce } from "lodash";
import classNames from "classnames";
import React, { type ChangeEvent, type FormEvent } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { decodeRecoveryKey } from "matrix-js-sdk/src/crypto-api";
import { type SecretStorage } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import Field from "../../elements/Field";
import AccessibleButton, { type ButtonEvent } from "../../elements/AccessibleButton";
import { _t } from "../../../../languageHandler";
import { accessSecretStorage } from "../../../../SecurityManager";
import Modal from "../../../../Modal";
import DialogButtons from "../../elements/DialogButtons";
import BaseDialog from "../BaseDialog";
import { chromeFileInputFix } from "../../../../utils/BrowserWorkarounds";

// Be generous: some users paste email/thread wrappers.
const KEY_FILE_MAX_SIZE = 32 * 1024; // 32KB
const VALIDATION_THROTTLE_MS = 200;
const REQUIRE_FLAG = "requireKeyVerification";

// Base58 alphabet (no 0,O,I,l,+,/ etc). Allow spaces/newlines between groups.
const BASE58_WITH_WS = /[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz\s]{20,}/;

export type KeyParams = { passphrase?: string; recoveryKey?: string };

interface IProps {
    keyInfo: SecretStorage.SecretStorageKeyDescription;
    checkPrivateKey: (k: KeyParams) => Promise<boolean>;
    onFinished(result?: false | KeyParams): void;
}

interface IState {
    recoveryKey: string;
    recoveryKeyValid: boolean | null;   // syntactically decodable
    recoveryKeyCorrect: boolean | null; // matches keyInfo
    recoveryKeyFileError: boolean | null;
    forceRecoveryKey: boolean;
    passPhrase: string;
    keyMatches: boolean | null;
    resetting: boolean;
    canClose: boolean;
}

export default class AccessSecretStorageDialog extends React.PureComponent<IProps, IState> {
    private fileUpload = React.createRef<HTMLInputElement>();
    private inputRef = React.createRef<HTMLInputElement>();

    private validateRecoveryKeyOnChange = debounce(async (key: string): Promise<void> => {
        await this.validateRecoveryKey(key);
    }, VALIDATION_THROTTLE_MS);

    public constructor(props: IProps) {
        super(props);
        this.state = {
            recoveryKey: "",
            recoveryKeyValid: null,
            recoveryKeyCorrect: null,
            recoveryKeyFileError: null,
            forceRecoveryKey: false,
            passPhrase: "",
            keyMatches: null,
            resetting: false,
            canClose: false,
        };
    }

    public componentDidMount(): void {
        try {
            localStorage.setItem(REQUIRE_FLAG, "true");
        } catch {
            /* ignore */
        }
    }

    private allowCloseAndFinish = (result?: false | KeyParams): void => {
        try {
            localStorage.removeItem(REQUIRE_FLAG);
        } catch {
            /* ignore */
        }
        // Mark session as verified only when we have a successful key input
        try {
            if (result && typeof result === "object" && ("passphrase" in result || "recoveryKey" in result)) {
                localStorage.setItem("sessionVerified", "true");
            }
        } catch {
            /* ignore */
        }
        this.setState({ canClose: true }, () => this.props.onFinished(result));
    };

    private onDialogFinished = (result?: false | KeyParams): void => {
        if (this.state.canClose) {
            this.props.onFinished(result);
        }
        // otherwise swallow close attempts
    };

    private onCancel = (): void => {
        if (this.state.resetting) this.setState({ resetting: false });
    };

    private onUseRecoveryKeyClick = (): void => {
        this.setState({ forceRecoveryKey: true });
    };

    private async validateRecoveryKey(key?: string): Promise<void> {
        const candidate = (key ?? this.state.recoveryKey).trim();
        if (candidate === "") {
            this.setState({ recoveryKeyValid: null, recoveryKeyCorrect: null });
            return;
        }
        try {
            const cli = MatrixClientPeg.safeGet();
            const decodedKey = decodeRecoveryKey(candidate);
            const correct = await cli.secretStorage.checkKey(decodedKey, this.props.keyInfo);
            this.setState({ recoveryKeyValid: true, recoveryKeyCorrect: correct });
        } catch {
            this.setState({ recoveryKeyValid: false, recoveryKeyCorrect: false });
        }
    }

    private onRecoveryKeyChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        const value = ev.target.value;
        this.setState({ recoveryKey: value, recoveryKeyFileError: null });
        if (this.fileUpload.current) this.fileUpload.current.value = "";
        this.validateRecoveryKeyOnChange(value);
    };

    // Try to decode ArrayBuffer with UTF-8 -> UTF-16LE -> UTF-16BE
    private decodeSmart(buffer: ArrayBuffer): string {
        const tryDecoders: Array<[string, boolean]> = [
            ["utf-8", false],
            ["utf-16le", false],
            ["utf-16be", false],
        ];
        for (const [label] of tryDecoders) {
            try {
                const td = new TextDecoder(label as any, { fatal: true });
                return td.decode(buffer);
            } catch {
                // keep trying
            }
        }
        // fallback (non-fatal utf-8)
        return new TextDecoder("utf-8").decode(buffer);
    }

    private onRecoveryKeyFileChange = async (ev: ChangeEvent<HTMLInputElement>): Promise<void> => {
        if (!ev.target.files?.length) return;

        const f = ev.target.files[0];

        if (f.size > KEY_FILE_MAX_SIZE) {
            this.setState({ recoveryKeyFileError: true, recoveryKeyCorrect: false, recoveryKeyValid: false });
            return;
        }

        // Decode with multiple encodings to handle Windows Notepad UTF-16, etc.
        const buf = await f.arrayBuffer();
        let contentsRaw = this.decodeSmart(buf);

        // Strip BOMs if any slipped through
        contentsRaw = contentsRaw.replace(/^\uFEFF/, "");

        // Find a plausible Base58 token, even if surrounded by extra text
        const match = contentsRaw.match(BASE58_WITH_WS);
        if (!match) {
            this.setState({
                recoveryKeyFileError: true,
                recoveryKeyCorrect: false,
                recoveryKeyValid: false,
                recoveryKey: localStorage.getItem("rememberKey") || "",
            });
            return;
        }

        // Normalize: collapse whitespace (Element prints with groups)
        const extracted = match[0].replace(/\s+/g, "").trim();

        this.setState({ recoveryKeyFileError: null, recoveryKey: extracted }, () => {
            void this.validateRecoveryKey(extracted);
        });
    };

    private onRecoveryKeyFileUploadClick = (): void => {
        this.fileUpload.current?.click();
    };

    private onPassPhraseNext = async (ev: FormEvent<HTMLFormElement> | React.MouseEvent): Promise<void> => {
        ev.preventDefault();
        if (this.state.passPhrase.length <= 0) {
            this.inputRef.current?.focus();
            return;
        }

        this.setState({ keyMatches: null });
        const input = { passphrase: this.state.passPhrase };
        const keyMatches = await this.props.checkPrivateKey(input);
        if (keyMatches) {
            this.allowCloseAndFinish(input);
        } else {
            this.setState({ keyMatches });
            this.inputRef.current?.focus();
        }
    };

    private onRecoveryKeyNext = async (ev: FormEvent<HTMLFormElement> | React.MouseEvent): Promise<void> => {
        ev.preventDefault();
        if (this.state.recoveryKey.trim().length === 0 || this.state.recoveryKeyValid === false) return;

        this.setState({ keyMatches: null });
        const input = { recoveryKey: this.state.recoveryKey };
        const keyMatches = await this.props.checkPrivateKey(input);

        if (keyMatches) {
            try {
                localStorage.setItem("rememberKey", this.state.recoveryKey);
            } catch {}
            this.allowCloseAndFinish(input);
        } else {
            this.setState({ keyMatches });
        }
    };

    private onPassPhraseChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        this.setState({ passPhrase: ev.target.value, keyMatches: null });
    };

    private onResetAllClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        this.setState({ resetting: true });
    };

    private onConfirmResetAllClick = async (): Promise<void> => {
        Modal.toggleCurrentDialogVisibility();
        try {
            await accessSecretStorage(
                async (): Promise<void> => {
                    this.allowCloseAndFinish({});
                },
                { forceReset: true, resetCrossSigning: true },
            );
        } catch (e) {
            logger.error(e);
            Modal.toggleCurrentDialogVisibility();
            this.setState?.({ resetting: false });
        }
    };

    private getKeyValidationText(): string {
        if (this.state.recoveryKeyFileError) {
            return _t("encryption|access_secret_storage_dialog|key_validation_text|wrong_file_type");
        } else if (this.state.recoveryKeyCorrect) {
            return _t("encryption|access_secret_storage_dialog|key_validation_text|recovery_key_is_correct");
        } else if (this.state.recoveryKeyValid) {
            return _t("encryption|access_secret_storage_dialog|key_validation_text|wrong_security_key");
        } else if (this.state.recoveryKeyValid === null) {
            return "";
        } else {
            return _t("encryption|access_secret_storage_dialog|key_validation_text|invalid_security_key");
        }
    }

    public render(): React.ReactNode {
        const hasPassphrase =
            this.props.keyInfo?.passphrase?.salt && this.props.keyInfo?.passphrase?.iterations;

        const resetLine = (
            <strong className="mx_AccessSecretStorageDialog_reset">
                {_t("encryption|reset_all_button", undefined, {
                    a: (sub) => (
                        <AccessibleButton
                            kind="link_inline"
                            onClick={this.onResetAllClick}
                            className="mx_AccessSecretStorageDialog_reset_link"
                        >
                            {sub}
                        </AccessibleButton>
                    ),
                })}
            </strong>
        );

        let content: React.ReactNode;
        let title: string;
        let titleClass: string[];

        if (this.state.resetting) {
            title = _t("encryption|access_secret_storage_dialog|reset_title");
            titleClass = ["mx_AccessSecretStorageDialog_titleWithIcon mx_AccessSecretStorageDialog_resetBadge"];
            content = (
                <div>
                    <p>{_t("encryption|access_secret_storage_dialog|reset_warning_1")}</p>
                    <p>{_t("encryption|access_secret_storage_dialog|reset_warning_2")}</p>
                    <DialogButtons
                        primaryButton={_t("action|reset")}
                        onPrimaryButtonClick={this.onConfirmResetAllClick}
                        hasCancel={true}
                        onCancel={this.onCancel}
                        focus={false}
                        primaryButtonClass="danger"
                    />
                </div>
            );
        } else if (hasPassphrase && !this.state.forceRecoveryKey) {
            title = _t("encryption|access_secret_storage_dialog|security_phrase_title");
            titleClass = ["mx_AccessSecretStorageDialog_titleWithIcon mx_AccessSecretStorageDialog_securePhraseTitle"];

            const keyStatus =
                this.state.keyMatches === false ? (
                    <div className="mx_AccessSecretStorageDialog_keyStatus">
                        {"\uD83D\uDC4E "}
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

                    <form className="mx_AccessSecretStorageDialog_primaryContainer" onSubmit={this.onPassPhraseNext}>
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
                            onPrimaryButtonClick={this.onPassPhraseNext}
                            hasCancel={false}
                            focus={false}
                            // primaryDisabled={this.state.passPhrase.length === 0}
                            additive={resetLine}
                        />
                    </form>
                </div>
            );
        } else {
            title = _t("encryption|access_secret_storage_dialog|security_key_title");
            titleClass = ["mx_AccessSecretStorageDialog_titleWithIcon mx_AccessSecretStorageDialog_secureBackupTitle"];

            const feedbackClasses = classNames({
                "mx_AccessSecretStorageDialog_recoveryKeyFeedback": true,
                "mx_AccessSecretStorageDialog_recoveryKeyFeedback--valid": this.state.recoveryKeyCorrect === true,
                "mx_AccessSecretStorageDialog_recoveryKeyFeedback--invalid": this.state.recoveryKeyCorrect === false,
            });
            const recoveryKeyFeedback = <div className={feedbackClasses}>{this.getKeyValidationText()}</div>;

            content = (
                <div>
                    <p>{_t("encryption|access_secret_storage_dialog|use_security_key_prompt")}</p>

                    <form
                        className="mx_AccessSecretStorageDialog_primaryContainer"
                        onSubmit={this.onRecoveryKeyNext}
                        spellCheck={false}
                        autoComplete="off"
                    >
                        <div className="mx_AccessSecretStorageDialog_recoveryKeyEntry">
                            <div className="mx_AccessSecretStorageDialog_recoveryKeyEntry_textInput">
                                <Field
                                    type="password"
                                    id="mx_securityKey"
                                    label={_t("encryption|access_secret_storage_dialog|security_key_title")}
                                    value={this.state.recoveryKey}
                                    onChange={this.onRecoveryKeyChange}
                                    autoFocus={true}
                                    forceValidity={this.state.recoveryKeyCorrect ?? undefined}
                                    autoComplete="off"
                                />
                            </div>
                            <span className="mx_AccessSecretStorageDialog_recoveryKeyEntry_entryControlSeparatorText">
                                {_t("encryption|access_secret_storage_dialog|separator", {
                                    recoveryFile: "",
                                    securityKey: "",
                                })}
                            </span>
                            <div>
                                <input
                                    type="file"
                                    className="mx_AccessSecretStorageDialog_recoveryKeyEntry_fileInput"
                                    ref={this.fileUpload}
                                    onClick={chromeFileInputFix}
                                    onChange={this.onRecoveryKeyFileChange}
                                />
                                <AccessibleButton kind="primary" onClick={this.onRecoveryKeyFileUploadClick}>
                                    {_t("action|upload")}
                                </AccessibleButton>
                            </div>
                        </div>
                        {recoveryKeyFeedback}
                        <DialogButtons
                            primaryButton={_t("action|continue")}
                            onPrimaryButtonClick={this.onRecoveryKeyNext}
                            hasCancel={false}
                            focus={false}
                            // Enable if we have some key and it's not explicitly invalid
                            // primaryDisabled={
                            //     !(this.state.recoveryKey.trim().length > 0 && this.state.recoveryKeyValid !== false)
                            // }
                            additive={resetLine}
                        />
                    </form>
                </div>
            );
        }

        return (
            <BaseDialog
                className="mx_AccessSecretStorageDialog"
                onFinished={this.onDialogFinished}
                title={title}
                titleClass={titleClass}
            >
                <div>{content}</div>
            </BaseDialog>
        );
    }
}
