/*
Copyright 2017-2024 New Vector Ltd.
Copyright 2016 Aviral Dasgupta

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect } from "react";
import { initializeSocketIfNeeded, disconnectSocket } from "./socketInitializer";

/**
 * Component that initializes the socket connection when the app loads
 * and cleans it up when unmounted
 */
const SocketInitializer: React.FC = () => {
    useEffect(() => {
        // Initialize socket connection
        const socket = initializeSocketIfNeeded();

        // Clean up when component unmounts
        return () => {
            disconnectSocket();
        };
    }, []);

    // This component doesn't render anything
    return null;
};

export default SocketInitializer;
