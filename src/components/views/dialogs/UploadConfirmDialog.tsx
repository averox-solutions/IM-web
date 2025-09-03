import React from "react";
import { FilesIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { fetchUserTokenAndPlatform } from "../../../utils/userdetails";
import { _t } from "../../../languageHandler";
import { getBlobSafeMimeType } from "../../../utils/blobs";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { fileSize } from "../../../utils/FileUtils";

// Base URL for backend services (e.g., notifications), configurable via env
// Primary: REACT_APP_NOTIFCATIONURL (as requested), Fallbacks: REACT_APP_BACKEND_URL, localhost
const NOTIFICATION_API_BASE_URL =
    process.env.REACT_APP_NOTIFCATIONURL ||  "http://localhost:4000";

interface IProps {
    file: File;
    currentIndex: number;
    totalFiles: number;
    onFinished: (uploadConfirmed: boolean, uploadAll?: boolean) => void;
}

interface IState {
    isBlocked: boolean;
    blockedReason?: string;
}

export default class UploadConfirmDialog extends React.Component<IProps, IState> {
    private readonly objectUrl: string;
    private readonly mimeType: string;

    private static readonly DISALLOWED_EXTENSIONS = new Set(["apk", "dmg", "exe"]);
    private static readonly DISALLOWED_MIME_SUBSTRINGS = [
        "application/vnd.android.package-archive", // .apk
        "application/x-apple-diskimage",          // .dmg
        "application/x-msdownload",               // .exe (common)
        "application/x-dosexec",                  // .exe (sometimes)
    ];

    public static defaultProps: Partial<IProps> = {
        totalFiles: 1,
        currentIndex: 0,
    };

    public constructor(props: IProps) {
        super(props);

        this.mimeType = getBlobSafeMimeType(props.file.type);
        const blob = new Blob([props.file], { type: this.mimeType });
        this.objectUrl = URL.createObjectURL(blob);

        const { blocked, reason } = this.isFileDisallowed(props.file.name, this.mimeType);
        this.state = {
            isBlocked: blocked,
            blockedReason: blocked ? reason : undefined,
        };
    }

    public componentWillUnmount(): void {
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    }

    private onCancelClick = (): void => {
        this.props.onFinished(false);
    };

    private getFileCategory(fileName: string): string {
        const extension = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase() : "";

        if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(extension)) return "image";
        if (["mp4", "mov", "avi", "mkv", "webm"].includes(extension)) return "video";
        if (["mp3", "wav", "ogg", "aac", "flac"].includes(extension)) return "audio";
        if (["pdf", "doc", "docx", "txt", "rtf"].includes(extension)) return "document";
        if (["xls", "xlsx", "csv"].includes(extension)) return "spreadsheet";
        if (["ppt", "pptx"].includes(extension)) return "presentation";
        return "other";
    }

    // Block logic (by extension + MIME)
    private isFileDisallowed(fileName: string, mimeType: string): { blocked: boolean; reason: string } {
        const ext = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase() : "";

        if (UploadConfirmDialog.DISALLOWED_EXTENSIONS.has(ext)) {
            return {
                blocked: true,
                reason: `This file type is not allowed`,
            };
        }

        if (UploadConfirmDialog.DISALLOWED_MIME_SUBSTRINGS.some(s => mimeType.toLowerCase().includes(s))) {
            return {
                blocked: true,
                reason: `This file’s content type (${mimeType}) is not allowed. Files like .apk, .dmg, and .exe are blocked.`,
            };
        }

        return { blocked: false, reason: "" };
    }

    // Helper: read mx_user_id from localStorage and return a nice display name
    private getLocalDisplayNameFromMxUserId(): string {
        try {
            const raw = (localStorage.getItem("mx_user_id") || "").trim();
            if (!raw) return "Unknown";

            let s = raw.startsWith("@") ? raw.slice(1) : raw;
            const colonIdx = s.indexOf(":");
            if (colonIdx !== -1) s = s.slice(0, colonIdx);

            s = s
                .split(/[._-]+/g)
                .filter(Boolean)
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join(" ");

            return s || "Unknown";
        } catch {
            return "Unknown";
        }
    }

    private async notifyPushNotifications(): Promise<void> {
        try {
            const savedCallData = JSON.parse(localStorage.getItem("activeCallData") || "{}");
            const { toUserIds, groupName, senderId } = savedCallData;

            if (!Array.isArray(toUserIds) || toUserIds.length === 0) {
                console.warn("❌ No valid user IDs found in localStorage to send notifications.");
                return;
            }

            const fileCategory = this.getFileCategory(this.props.file.name);
            const cleanedLocalName = this.getLocalDisplayNameFromMxUserId();
            const targetName = groupName || cleanedLocalName || senderId;

            for (const userId of toUserIds) {
                try {

                    await fetch(`${NOTIFICATION_API_BASE_URL}/send-notification`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            userId: userId,
                            notificationTitle: targetName,
                            notificationBody: fileCategory,
                        }),
                    });

                    console.log(`Notification sent to ${userId}`);
                } catch (e) {
                    console.warn(`Failed to send FCM to ${userId}`, e);
                }
            }
        } catch (error) {
            console.error("❌ Error notifying push notifications:", error);
        }
    }

    private onUploadClick = (): void => {
        if (this.state.isBlocked) {
            console.warn("Blocked upload attempt for disallowed file type.");
            return;
        }

        const { name } = this.props.file;
        const extension = name.includes(".") ? name.substring(name.lastIndexOf(".") + 1) : "";
        console.log("Uploading file name:", name);
        console.log("Uploading file extension:", extension);

        this.notifyPushNotifications();
        this.props.onFinished(true);
    };

    private onUploadAllClick = (): void => {
        if (this.state.isBlocked) {
            console.warn("Blocked 'Upload All' due to disallowed file type.");
            return;
        }
        this.props.onFinished(true, true);
    };

    public render(): React.ReactNode {
        let title: string;
        if (this.props.totalFiles > 1) {
            title = _t("upload_file|title_progress", {
                current: this.props.currentIndex + 1,
                total: this.props.totalFiles,
            });
        } else {
            title = _t("upload_file|title");
        }

        const fileId = `mx-uploadconfirmdialog-${this.props.file.name}`;
        let preview: JSX.Element | undefined;
        let placeholder: JSX.Element | undefined;

        if (this.mimeType.startsWith("image/")) {
            preview = (
                <img
                    className="mx_UploadConfirmDialog_imagePreview"
                    src={this.objectUrl}
                    aria-labelledby={fileId}
                />
            );
        } else if (this.mimeType.startsWith("video/")) {
            preview = (
                <video
                    className="mx_UploadConfirmDialog_imagePreview"
                    src={this.objectUrl}
                    playsInline
                    controls={false}
                />
            );
        } else {
            placeholder = <FilesIcon className="mx_UploadConfirmDialog_fileIcon" height="18px" width="18px" />;
        }

        const uploadAllButton =
            !this.state.isBlocked && this.props.currentIndex + 1 < this.props.totalFiles ? (
                <button onClick={this.onUploadAllClick}>{_t("upload_file|upload_all_button")}</button>
            ) : undefined;

        return (
            <BaseDialog
                className="mx_UploadConfirmDialog"
                fixedWidth={false}
                onFinished={this.onCancelClick}
                title={title}
                contentId="mx_Dialog_content"
            >
                <div id="mx_Dialog_content">
                    <div className="mx_UploadConfirmDialog_previewOuter">
                        <div className="mx_UploadConfirmDialog_previewInner">
                            {preview}
                            <div id={fileId}>
                                {placeholder}
                                {this.props.file.name} ({fileSize(this.props.file.size)})
                            </div>
                        </div>
                    </div>

                    {this.state.isBlocked && (
                        <div
                            style={{
                                marginTop: 12,
                                padding: "10px 12px",
                                borderRadius: 8,
                                background: "rgba(255,0,0,0.08)",
                                border: "1px solid rgba(255,0,0,0.35)",
                                fontWeight: 500,
                            }}
                            role="alert"
                        >
                            {this.state.blockedReason}
                        </div>
                    )}
                </div>

                <DialogButtons
                    primaryButton={_t("action|upload")}
                    hasCancel={false}
                    onPrimaryButtonClick={this.onUploadClick}
                    focus={true}
                >
                    
                </DialogButtons>
            </BaseDialog>
        );
    }
}
