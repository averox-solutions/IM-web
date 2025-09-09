/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { _t } from "../../../../../languageHandler";
import SdkConfig from "../../../../../SdkConfig";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import { UIFeature } from "../../../../../settings/UIFeature";
import { LayoutSwitcher } from "../../LayoutSwitcher";
import FontScalingPanel from "../../FontScalingPanel";
import { ThemeChoicePanel } from "../../ThemeChoicePanel"; // (kept if used elsewhere)
import ImageSizePanel from "../../ImageSizePanel";
import SettingsTab from "../SettingsTab";

export default class AppearanceUserSettingsTab extends React.Component<EmptyObject> {
    public constructor(props: EmptyObject) {
        super(props);
    }

    private renderAdvancedSettings(): React.ReactNode {
        if (!SettingsStore.getValue(UIFeature.AdvancedSettings)) return null;

        const brand = SdkConfig.get().brand;
        const tooltipContent = _t("settings|appearance|custom_font_description", { brand });

        return (
            <>
                {/* Removed SettingsFlag for useCompactLayout */}
                {/* Removed Field for systemFont */}
            </>
        );
    }

    public render(): React.ReactNode {
        return (
            <SettingsTab data-testid="mx_AppearanceUserSettingsTab">
                {/* Removed SettingsSection and SettingsSubsection wrappers */}
                <LayoutSwitcher />
                <FontScalingPanel />
                {this.renderAdvancedSettings()}
                <ImageSizePanel />
            </SettingsTab>
        );
    }
}
