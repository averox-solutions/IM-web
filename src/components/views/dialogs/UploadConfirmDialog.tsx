import React from "react";
import { FilesIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { fetchUserTokenAndPlatform } from "../../../utils/userdetails";
import { _t } from "../../../languageHandler";
import { getBlobSafeMimeType } from "../../../utils/blobs";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { fileSize } from "../../../utils/FileUtils";

interface IProps {
    file: File;
    currentIndex: number;
    totalFiles: number;
    onFinished: (uploadConfirmed: boolean, uploadAll?: boolean) => void;
}

export default class UploadConfirmDialog extends React.Component<IProps> {
    private readonly objectUrl: string;
    private readonly mimeType: string;

    public static defaultProps: Partial<IProps> = {
        totalFiles: 1,
        currentIndex: 0,
    };

    public constructor(props: IProps) {
        super(props);
        // Create a fresh `Blob` for previewing (even though `File` already is one)
        // so we can adjust the MIME type if needed.
        this.mimeType = getBlobSafeMimeType(props.file.type);
        const blob = new Blob([props.file], { type: this.mimeType });
        this.objectUrl = URL.createObjectURL(blob);
    }

    public componentWillUnmount(): void {
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    }

    private onCancelClick = (): void => {
        this.props.onFinished(false);
    };

    private getFileCategory(fileName: string): string {
        const extension = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase() : "";

        if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(extension)) {
            return "image";
        }
        if (["mp4", "mov", "avi", "mkv", "webm"].includes(extension)) {
            return "video";
        }
        if (["mp3", "wav", "ogg", "aac", "flac"].includes(extension)) {
            return "audio";
        }
        if (["pdf", "doc", "docx", "txt", "rtf"].includes(extension)) {
            return "document";
        }
        if (["xls", "xlsx", "csv"].includes(extension)) {
            return "spreadsheet";
        }
        if (["ppt", "pptx"].includes(extension)) {
            return "presentation";
        }
        return "other";  // Default for other file types
    }

    private async notifyPushNotifications(): Promise<void> {
        try {
            // Fetch user data from localStorage
            const savedCallData = JSON.parse(localStorage.getItem("activeCallData") || '{}');
            const { toUserIds, groupName } = savedCallData;

            // Ensure toUserIds exists and is an array
            if (!Array.isArray(toUserIds) || toUserIds.length === 0) {
                console.warn("❌ No valid user IDs found in localStorage to send notifications.");
                return;
            }

            // Get the file's category
            const fileCategory = this.getFileCategory(this.props.file.name);

            // Prepare the notification message based on file category
            let notificationMessage: string;

            // If it's a group, don't include user ID in the title, use groupName instead
            if (groupName) {
                notificationMessage = `New ${fileCategory} shared in the group ${groupName}`;
            } else {
                switch (fileCategory) {
                    case "image":
                        notificationMessage = `New image message from someone`;
                        break;
                    case "video":
                        notificationMessage = `New video message from someone`;
                        break;
                    case "audio":
                        notificationMessage = `New audio message from someone`;
                        break;
                    case "document":
                        notificationMessage = `New document shared by someone`;
                        break;
                    case "spreadsheet":
                        notificationMessage = `New spreadsheet shared by someone`;
                        break;
                    case "presentation":
                        notificationMessage = `New presentation shared by someone`;
                        break;
                    default:
                        notificationMessage = `New file shared by someone`;
                }
            }

            // Loop over all users and send notifications
            for (const userId of toUserIds) {
                try {
                    const { fcmtoken, is_iOS } = await fetchUserTokenAndPlatform(userId);

                    // Send notification
                    await fetch("http://localhost:4000/send-notification", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            fcmToken: fcmtoken,
                            notificationTitle: userId,
                            notificationBody: this.props.file.name,
                            badgeValue: 1,
                            platform: is_iOS ? "ios" : "android",
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
        // --- NEW LOGGING: file name and extension ---
        const { name } = this.props.file;
        const extension = name.includes(".") ? name.substring(name.lastIndexOf(".") + 1) : "";
        console.log("Uploading file name:", name);
        console.log("Uploading file extension:", extension);
        // ------------------------------------------

        // Send the notifications after the upload
        this.notifyPushNotifications();

        // Finish the upload
        this.props.onFinished(true);
    };

    private onUploadAllClick = (): void => {
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
            this.props.currentIndex + 1 < this.props.totalFiles ? (
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
                </div>

                <DialogButtons
                    primaryButton={_t("action|upload")}
                    hasCancel={false}
                    onPrimaryButtonClick={this.onUploadClick}
                    focus={true}
                >
                    {uploadAllButton}
                </DialogButtons>
            </BaseDialog>
        );
    }
}
