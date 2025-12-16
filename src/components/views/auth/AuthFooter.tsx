/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";

import { _t } from "../../../languageHandler";

const AuthFooter = (): ReactElement => {
    // Beep information links for login/registration pages

    return (
        <footer className="mx_AuthFooter" role="contentinfo">
            <span className="mx_AuthFooter_version">Version 4.1</span>
        </footer>
    );
};

export default AuthFooter;
