/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { ZIM } from "zego-zim-web";

// Define the expected Zego instance type
type ZegoInstanceType = ReturnType<typeof ZegoUIKitPrebuilt.create> | null;

// Define the context type
interface ZegoContextType {
  zegoInstance: ZegoInstanceType;
}

// Create context with a default value
const ZegoContext = createContext<ZegoContextType>({ zegoInstance: null });

// Define provider props interface
interface ZegoProviderProps {
  children: ReactNode;
}

// Replace with your credentials
const APP_ID = 1146553792;
const SERVER_SECRET = "804182900b0b2337d9bfa362b3630ace";

// Provider component
export const ZegoProvider: React.FC<ZegoProviderProps> = ({ children }) => {
  const [zegoInstance, setZegoInstance] = useState<ZegoInstanceType>(null);
  const zegoRef = useRef<ZegoInstanceType>(null); // Track latest instance

  useEffect(() => {
    let retryInterval: NodeJS.Timeout;

    const initZego = (): void => {
      if (zegoRef.current) {
        console.log("✅ Zego already initialized, skipping re-initialization.");
        return;
      }

      const rawUserId = localStorage.getItem("mx_user_id") || "";
      const currentUserDisplayName = localStorage.getItem("mx_profile_displayname") || "";
      const currentUserId = rawUserId.replace(/[^a-zA-Z0-9]/g, ""); // Clean user ID
      if (!currentUserId || !currentUserDisplayName) {
        console.error("🚨 Missing User ID or Display Name");
        return;
      }

      try {
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          APP_ID,
          SERVER_SECRET,
          null, // No specific room ID
          currentUserId,
          currentUserDisplayName
        );

        if (!kitToken) {
          console.error("❌ Failed to generate Kit Token.");
          return;
        }

        const instance = ZegoUIKitPrebuilt.create(kitToken);
        instance.addPlugins({ ZIM });

        instance.setCallInvitationConfig({
          enableNotifyWhenAppRunningInBackgroundOrQuit: true,
          ringtoneConfig: {
            incomingCallUrl:
              "https://firebasestorage.googleapis.com/v0/b/laaleh-2451e.appspot.com/o/ring.ogg?alt=media&token=f7ff8103-a1e5-42a6-a7d3-12c73b5bda2e",
            outgoingCallUrl:
              "https://firebasestorage.googleapis.com/v0/b/laaleh-2451e.appspot.com/o/ringback.ogg?alt=media&token=308068d4-a9af-4b1f-a4da-d8cc1f237685",
          },
        });

        // Update both state and ref
        setZegoInstance(instance);
        zegoRef.current = instance;

        console.log("✅ Zego Initialized Successfully");

        // Clear retry if initialization is successful
        clearInterval(retryInterval);
      } catch (error) {
        console.error("❌ Error initializing Zego:", error);
      }
    };

    // Try to initialize immediately and retry every 3 seconds if it fails
    initZego();
    retryInterval = setInterval(() => {
      if (!zegoRef.current) {
        console.warn("🔄 Retrying Zego Initialization...");
        initZego();
      }
    }, 1000);

    // Cleanup interval when component unmounts
    return () => clearInterval(retryInterval);
  }, []);

  return (
    <ZegoContext.Provider value={{ zegoInstance }}>
      {children}
    </ZegoContext.Provider>
  );
};

// Custom hook to use Zego
export const useZego = (): ZegoInstanceType => {
  return useContext(ZegoContext).zegoInstance;
};
