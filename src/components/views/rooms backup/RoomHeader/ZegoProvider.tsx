/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

PDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { ZIM } from "zego-zim-web";

type ZegoInstanceType = ReturnType<typeof ZegoUIKitPrebuilt.create> | null;

interface KitTokenResponse {
  kitToken: string;
}

const ZegoContext = createContext<ZegoInstanceType>(null);

interface ZegoProviderProps {
  children: ReactNode;
}

export const ZegoProvider: React.FC<ZegoProviderProps> = ({ children }) => {
  const [zegoInstance, setZegoInstance] = useState<ZegoInstanceType>(null);

  useEffect(() => {
    const initZego = async () => {
      try {
        const rawUserId = localStorage.getItem("mx_user_id") || "";
        const currentUserDisplayName = localStorage.getItem("mx_profile_displayname") || "";
        const currentUserId = rawUserId.replace(/[^a-zA-Z0-9]/g, "");

        if (!currentUserId || !currentUserDisplayName) {
          console.error("Missing User ID or Display Name");
          return;
        }

        // Fetch kitToken from secure backend (Recommended)
        const response = await fetch("/api/generate-zego-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUserId, displayName: currentUserDisplayName }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch kit token: ${response.statusText}`);
        }

        const data: KitTokenResponse = await response.json();
        if (!data.kitToken) {
          console.error("Failed to generate Kit Token.");
          return;
        }

        const instance = ZegoUIKitPrebuilt.create(data.kitToken);
        instance.addPlugins({ ZIM });

        setZegoInstance(instance);
        console.log("Zego Initialized Successfully");
      } catch (error) {
        console.error("Error initializing Zego:", error);
      }
    };

    initZego();
  }, []);

  return <ZegoContext.Provider value={zegoInstance}>{children}</ZegoContext.Provider>;
};

// Custom hook to use Zego
export const useZego = (): ZegoInstanceType => {
  return useContext(ZegoContext);
};
