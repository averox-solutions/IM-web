import React from "react";
import { FilesIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
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

    private onUploadClick = (): void => {
        if (this.state.isBlocked) {
            console.warn("Blocked upload attempt for disallowed file type.");
            return;
        }

        const { name } = this.props.file;
        const extension = name.includes(".") ? name.substring(name.lastIndexOf(".") + 1) : "";
        console.log("Uploading file name:", name);
        console.log("Uploading file extension:", extension);

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
