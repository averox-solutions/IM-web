/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2024 The Matrix.org Foundation C.I.C.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import React, { type ChangeEvent, type ReactNode, useCallback, useEffect, useMemo, useState, useId } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { EditInPlace, Alert, ErrorMessage } from "@vector-im/compound-web";
import PopOutIcon from "@vector-im/compound-design-tokens/assets/web/icons/pop-out";
import { _t } from "../../../languageHandler";
import { OwnProfileStore } from "../../../stores/OwnProfileStore";
import AvatarSetting from "./AvatarSetting";
import PosthogTrackers from "../../../PosthogTrackers";
import { formatBytes } from "../../../utils/FormattingUtils";
import { useToastContext } from "../../../contexts/ToastContext";
import InlineSpinner from "../elements/InlineSpinner";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";
import CopyableText from "../elements/CopyableText";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import AccessibleButton from "../elements/AccessibleButton";
import LogoutDialog, { shouldShowLogoutDialog } from "../dialogs/LogoutDialog";
import Modal from "../../../Modal";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Flex } from "../../utils/Flex";
import { getMinistryFromUserId, getUserDesignation } from "../../../utils/MinistryUtils";
import type { Ministry, Designation } from "../../../utils/MinistryUtils";

const SpinnerToast: React.FC<{ children?: ReactNode }> = ({ children }) => (
    <>
        <InlineSpinner />
        {children}
    </>
);

interface UsernameBoxProps {
    username: string;
}

const UsernameBox: React.FC<UsernameBoxProps> = ({ username }) => {
    const labelId = useId();
    return (
        <div className="mx_UserProfileSettings_profile_controls_userId">
            <div className="mx_UserProfileSettings_profile_controls_userId_label" id={labelId}>
                {_t("settings|general|username")}
            </div>
            <CopyableText getTextToCopy={() => username} aria-labelledby={labelId}>
                {username}
            </CopyableText>
        </div>
    );
};

interface MinistryBoxProps {
    ministry: Ministry | null;
    loading: boolean;
}

const MinistryBox: React.FC<MinistryBoxProps> = ({ ministry, loading }) => {
    const labelId = useId();

    // Shared styling for the boxes
    const boxStyle: React.CSSProperties = {
        background: "var(--cpd-color-bg-subtle)",
        padding: "12px",
        borderRadius: "8px",
        border: "1px solid var(--cpd-color-border-subtle)",
    };

    if (loading) {
        return (
            <div className="mx_UserProfileSettings_profile_controls_ministry" style={boxStyle}>
                <div className="mx_UserProfileSettings_profile_controls_ministry_label" id={labelId} style={{ fontWeight: "600", marginBottom: "4px" }}>
                    {_t("settings|general|ministry")}
                </div>
                <InlineSpinner />
            </div>
        );
    }

    if (!ministry) {
        return null;
    }

    return (
        <div className="mx_UserProfileSettings_profile_controls_ministry" style={boxStyle}>
            <div className="mx_UserProfileSettings_profile_controls_ministry_label" id={labelId} style={{ fontWeight: "600", marginBottom: "4px", color: "var(--cpd-color-text-secondary)" }}>
                {_t("settings|general|ministry")}
            </div>
            <CopyableText getTextToCopy={() => ministry.name} aria-labelledby={labelId} className="mx_UserProfileSettings_ministry_value" style={{ fontSize: "15px", fontWeight: "500" }}>
                {ministry.name.length > 25 ? `${ministry.name.slice(0, 25)}...` : ministry.name}
            </CopyableText>
        </div>
    );
};

interface DesignationBoxProps {
    designation: Designation | null;
    loading: boolean;
}

const DesignationBox: React.FC<DesignationBoxProps> = ({ designation, loading }) => {
    const labelId = useId();

    // Shared styling for the boxes
    const boxStyle: React.CSSProperties = {
        background: "var(--cpd-color-bg-subtle)",
        padding: "12px",
        borderRadius: "8px",
        border: "1px solid var(--cpd-color-border-subtle)",
        flex: 1,
    };

    if (loading) {
        return (
            <div className="mx_UserProfileSettings_profile_controls_designation" style={boxStyle}>
                <div className="mx_UserProfileSettings_profile_controls_designation_label" id={labelId} style={{ fontWeight: "600", marginBottom: "4px" }}>
                    {_t("settings|general|designation")}
                </div>
                <InlineSpinner />
            </div>
        );
    }

    if (!designation) {
        return null;
    }

    return (
        <div className="mx_UserProfileSettings_profile_controls_designation" style={boxStyle}>
            <div className="mx_UserProfileSettings_profile_controls_designation_label" id={labelId} style={{ fontWeight: "600", marginBottom: "4px", color: "var(--cpd-color-text-secondary)" }}>
                {_t("settings|general|designation")}
            </div>
            <CopyableText getTextToCopy={() => designation.name} aria-labelledby={labelId} className="mx_UserProfileSettings_designation_value" style={{ fontSize: "15px", fontWeight: "500" }}>
                {designation.name.length > 25 ? `${designation.name.slice(0, 25)}...` : designation.name}
            </CopyableText>
        </div>
    );
};

interface ManageAccountButtonProps {
    externalAccountManagementUrl: string;
}

const ManageAccountButton: React.FC<ManageAccountButtonProps> = ({ externalAccountManagementUrl }) => (
    <AccessibleButton
        onClick={null}
        element="a"
        kind="primary"
        target="_blank"
        rel="noreferrer noopener"
        href={externalAccountManagementUrl}
        data-testid="external-account-management-link"
    >
        <PopOutIcon className="mx_UserProfileSettings_accountmanageIcon" width="24" height="24" />
        {_t("settings|general|oidc_manage_button")}
    </AccessibleButton>
);

const SignOutButton: React.FC = () => {
    const client = useMatrixClientContext();
    const onClick = useCallback(async () => {
        if (await shouldShowLogoutDialog(client)) {
            Modal.createDialog(LogoutDialog);
        } else {
            defaultDispatcher.dispatch({ action: "logout" });
        }
    }, [client]);
    return (
        // <AccessibleButton onClick={onClick} kind="danger_outline">
        //     <SignOutIcon className="mx_UserProfileSettings_accountmanageIcon" width="24" height="24" />
        //     {_t("action|sign_out")}
        // </AccessibleButton>
        <></>
    );
};

interface UserProfileSettingsProps {
    externalAccountManagementUrl?: string;
    canSetDisplayName: boolean;
    canSetAvatar: boolean;
}

const UserProfileSettings: React.FC<UserProfileSettingsProps> = ({
    externalAccountManagementUrl,
    canSetDisplayName,
    canSetAvatar,
}) => {
    const [avatarURL, setAvatarURL] = useState(OwnProfileStore.instance.avatarMxc);
    const [displayName, setDisplayName] = useState(OwnProfileStore.instance.displayName ?? "");
    const [avatarError, setAvatarError] = useState<boolean>(false);
    const [maxUploadSize, setMaxUploadSize] = useState<number | undefined>();
    const [setDisplayNameError] = useState<boolean>(false);
    const [ministry, setMinistry] = useState<Ministry | null>(null);
    const [ministryLoading, setMinistryLoading] = useState<boolean>(true);
    const [designation, setDesignation] = useState<Designation | null>(null);
    const [designationLoading, setDesignationLoading] = useState<boolean>(true);
    const toastRack = useToastContext();
    const client = useMatrixClientContext();
    const DISPLAY_NAME_REGEX = /^[a-zA-Z0-9 ]{1,50}$/;

    useEffect(() => {
        (async () => {
            try {
                const mediaConfig = await client.getMediaConfig();
                setMaxUploadSize(mediaConfig["m.upload.size"]);
            } catch (e) {
                logger.warn("Failed to get media config", e);
            }
        })();
    }, [client]);

    useEffect(() => {
        (async () => {
            try {
                setMinistryLoading(true);
                setDesignationLoading(true);
                const userId = client.getUserId();
                if (userId) {
                    const ministryData = await getMinistryFromUserId(userId);
                    setMinistry(ministryData);
                    setMinistryLoading(false);

                    // Fetch designation after ministry is loaded
                    if (ministryData) {
                        try {
                            // Try to get designation from account data first
                            const accountData = client.getAccountData("org.beep.designation");
                            const accountDataContent = accountData?.getContent<{ designation?: string }>();

                            const designationData = await getUserDesignation(
                                userId,
                                ministryData,
                                accountDataContent,
                            );
                            setDesignation(designationData);
                        } catch (e) {
                            logger.warn("Failed to get designation info", e);
                        } finally {
                            setDesignationLoading(false);
                        }
                    } else {
                        setDesignationLoading(false);
                    }
                } else {
                    setMinistryLoading(false);
                    setDesignationLoading(false);
                }
            } catch (e) {
                logger.warn("Failed to get ministry info", e);
                setMinistryLoading(false);
                setDesignationLoading(false);
            }
        })();
    }, [client]);

    const onAvatarRemove = useCallback(async () => {
        const removeToast = toastRack.displayToast(
            <SpinnerToast>{_t("settings|general|avatar_remove_progress")}</SpinnerToast>,
        );
        try {
            await client.setAvatarUrl("");
            setAvatarURL("");
        } finally {
            removeToast();
        }
    }, [toastRack, client]);

    const onAvatarChange = useCallback(
        async (avatarFile: File) => {
            PosthogTrackers.trackInteraction("WebProfileSettingsAvatarUploadButton");
            logger.log(`Uploading new avatar: ${avatarFile.name} (${avatarFile.size} bytes)`);

            const removeToast = toastRack.displayToast(
                <SpinnerToast>{_t("settings|general|avatar_save_progress")}</SpinnerToast>,
            );

            try {
                setAvatarError(false);
                const { content_uri: uri } = await client.uploadContent(avatarFile);
                await client.setAvatarUrl(uri);
                setAvatarURL(uri);
            } catch {
                setAvatarError(true);
            } finally {
                removeToast();
            }
        },
        [toastRack, client],
    );

    const onDisplayNameChanged = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.slice(0, 50);
        setDisplayName(value);
        setDisplayNameError(!DISPLAY_NAME_REGEX.test(value));
    }, [DISPLAY_NAME_REGEX]);

    const onDisplayNameCancel = useCallback(() => {
        const originalName = OwnProfileStore.instance.displayName ?? "";
        setDisplayName(originalName);
        setDisplayNameError(!DISPLAY_NAME_REGEX.test(originalName));
    }, []);

    const onDisplayNameSave = useCallback(async (): Promise<void> => {
        if (!DISPLAY_NAME_REGEX.test(displayName)) {
            setDisplayNameError(true);
            return;
        }

        try {
            setDisplayNameError(false);
            await client.setDisplayName(displayName);
        } catch (e) {
            setDisplayNameError(true);
            throw e;
        }
    }, [displayName, client]);

    const userIdentifier = useMemo(
        () =>
            UserIdentifierCustomisations.getDisplayUserIdentifier(client.getSafeUserId(), {
                withDisplayName: true,
            }),
        [client],
    );

    const someFieldsDisabled = !canSetDisplayName || !canSetAvatar;

    return (
        <div className="mx_UserProfileSettings">
            <h2>{_t("common|profile")}</h2>
            <div>
                {someFieldsDisabled
                    ? _t("settings|general|profile_subtitle_oidc")
                    : _t("settings|general|profile_subtitle")}
            </div>
            <div className="mx_UserProfileSettings_profile">
                <AvatarSetting
                    avatar={avatarURL ?? undefined}
                    avatarAltText={_t("common|user_avatar")}
                    onChange={onAvatarChange}
                    removeAvatar={avatarURL ? onAvatarRemove : undefined}
                    placeholderName={displayName}
                    placeholderId={client.getUserId() ?? ""}
                    disabled={!canSetAvatar}
                />
                <div className="mx_UserProfileSettings_profile_controls" style={{ flex: 1, minWidth: 0 }}>
                    <EditInPlace
                        className="mx_UserProfileSettings_profile_displayName"
                        label={_t("settings|general|display_name")}
                        value={displayName}
                        saveButtonLabel={_t("common|save")}
                        cancelButtonLabel={_t("common|cancel")}
                        savedLabel={_t("common|saved")}
                        savingLabel={_t("common|updating")}
                        onChange={onDisplayNameChanged}
                        onCancel={onDisplayNameCancel}
                        onSave={onDisplayNameSave}
                        disabled={!canSetDisplayName}
                        inputProps={{
                            maxLength: 50,
                            pattern: "[a-zA-Z0-9 ]{1,50}",
                            autoComplete: "off",
                        }}
                    >
                        {(displayName.length > 50 || !DISPLAY_NAME_REGEX.test(displayName)) && (
                            <ErrorMessage>
                                {_t("settings|general|display_name_error") +
                                    ": Max 50 characters. Only letters, numbers, and spaces allowed."}
                            </ErrorMessage>
                        )}
                    </EditInPlace>
                    <Flex gap="16px" style={{ marginTop: "16px" }}>
                        <MinistryBox ministry={ministry} loading={ministryLoading} />
                        <DesignationBox designation={designation} loading={designationLoading} />
                    </Flex>
                </div>
            </div>
            {avatarError && (
                <Alert title={_t("settings|general|avatar_upload_error_title")} type="critical">
                    {maxUploadSize === undefined
                        ? _t("settings|general|avatar_upload_error_text_generic")
                        : _t("settings|general|avatar_upload_error_text", { size: formatBytes(maxUploadSize) })}
                </Alert>
            )}
            {userIdentifier && <UsernameBox username={userIdentifier} />}

            <Flex gap="var(--cpd-space-4x)" className="mx_UserProfileSettings_profile_buttons">
                {externalAccountManagementUrl && (
                    <ManageAccountButton externalAccountManagementUrl={externalAccountManagementUrl} />
                )}
                <SignOutButton />
            </Flex>
        </div>
    );
};

export default UserProfileSettings;