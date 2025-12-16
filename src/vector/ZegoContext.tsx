/*
Copyright 2018-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import React, { createContext, useContext, useState, useEffect } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { ZIM } from "zego-zim-web";

const APP_ID = 1146553792;
const SERVER_SECRET = "804182900b0b2337d9bfa362b3630ace";

interface RoomConfig {
  container?: HTMLElement | null;
  turnOnMicrophoneWhenJoining?: boolean;
  showMyCameraToggleButton?: boolean;
  showMyMicrophoneToggleButton?: boolean;
  showAudioVideoSettingsButton?: boolean;
  showTextChat?: boolean;
  showUserList?: boolean;
  maxUsers?: number;
  layout?: "Sidebar" | "Grid" | "Auto";
  showScreenSharingButton?: boolean;
  showLayoutButton?: boolean;
  showPinButton?: boolean;
}

interface ZegoContextType {
  zp: any;
  initialized: boolean;
  roomConfig: RoomConfig;
  sendCallInvitation: (targetUsers: string[], callType: "voice" | "video") => void;
}

const ZegoContext = createContext<ZegoContextType | undefined>(undefined);

export const ZegoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [zp, setZp] = useState<any>(null);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [roomConfig] = useState<RoomConfig>({
    showTextChat: false,
    showUserList: true,
    maxUsers: 40,
    layout: "Grid",
    showScreenSharingButton: false,
    showLayoutButton: true,
    showPinButton: true,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (!initialized) {
        console.log("🔄 Attempting to initialize Zego...");
        initZego();
      } else {
        clearInterval(interval);
      }
    }, 3000); // Retry every 3 seconds

    return () => clearInterval(interval);
  }, [initialized]);

  const cleanUserId = (id: string): string => {
    return id.replace(/[^a-zA-Z0-9]/g, "");
  };

  const initZego = (): void => {
    const rawUserId = localStorage.getItem("mx_user_id") || "";
    const currentUserDisplayName = localStorage.getItem("mx_profile_displayname") || "";
    const currentUserId = cleanUserId(rawUserId);

    if (!currentUserId || !currentUserDisplayName) {
      console.error("🚨 Error: Missing User ID or Display Name in localStorage.");
      return;
    }

    try {
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        APP_ID,
        SERVER_SECRET,
        null, // Change dynamically if needed
        currentUserId,
        currentUserDisplayName
      );

      if (!kitToken) {
        console.error("❌ Failed to generate Kit Token.");
        return;
      }

      const zegoInstance = ZegoUIKitPrebuilt.create(kitToken);
      zegoInstance.addPlugins({ ZIM });

      zegoInstance.onIncomingCallReceived = (callInfo) => {
        console.log("📞 Incoming call received:", callInfo);
        // Don't show alert in responsive mode
        const isResponsiveMode = typeof window !== 'undefined' && window.innerWidth <= 767;
        if (!isResponsiveMode) {
        alert(`📲 Incoming ${callInfo.callType} call from ${callInfo.caller.userID}`);
        }
      };

      Notification.requestPermission().then((permission) => {
        if (permission !== "granted") {
          console.warn("⚠️ Notification permission denied. Calls may not be received.");
        }
      });

      zegoInstance.setCallInvitationConfig({
        enableNotifyWhenAppRunningInBackgroundOrQuit: true,
        showScreenSharingButton: false,
        showTextChat: false,
        onSetRoomConfigBeforeJoining: () => roomConfig,
        onSetRoomConfigAfterJoining: () => roomConfig,
        ringtoneConfig: {
          incomingCallUrl:
            "https://firebasestorage.googleapis.com/v0/b/laaleh-2451e.appspot.com/o/ring.ogg?alt=media&token=f7ff8103-a1e5-42a6-a7d3-12c73b5bda2e",
          outgoingCallUrl:
            "https://firebasestorage.googleapis.com/v0/b/laaleh-2451e.appspot.com/o/ringback.ogg?alt=media&token=308068d4-a9af-4b1f-a4da-d8cc1f237685",
        },
      });

      setZp(zegoInstance);
      setInitialized(true);
      console.log("✅ Zego UI Kit initialized successfully.");
    } catch (error) {
      console.error("❌ Error initializing Zego UI Kit:", error);
    }
  };

  const sendCallInvitation = (targetUsers: string[], callType: "voice" | "video"): void => {
    if (!initialized || !zp) {
      console.error("🚨 Zego UI Kit not initialized.");
      return;
    }

    if (typeof zp.sendCallInvitation !== "function") {
      console.error("❌ sendCallInvitation function is not available on Zego instance.");
      return;
    }

    const callTypeMapping = {
      voice: ZegoUIKitPrebuilt.InvitationTypeVoiceCall,
      video: ZegoUIKitPrebuilt.InvitationTypeVideoCall,
    };

    try {
      zp.sendCallInvitation({
        callees: targetUsers,
        callType: callTypeMapping[callType],
        timeout: 60,
        mediaconfig: { audio: true, video: callType === "video" },
      });

      console.log(`📞 Call invitation sent to ${targetUsers.join(", ")} (${callType} call).`);
    } catch (error) {
      console.error("❌ Error sending call invitation:", error);
    }
  };

  return (
    <ZegoContext.Provider value={{ zp, initialized, roomConfig, sendCallInvitation }}>
      {children}
    </ZegoContext.Provider>
  );
};

export const useZego = (): ZegoContextType => {
  const context = useContext(ZegoContext);
  if (!context) {
    throw new Error("useZego must be used within a ZegoProvider");
  }
  return context;
};
