import fetch from "node-fetch";

const B_SERVICES_API_KEY = "4a2c6375c9ce9ec0a11c5761581a379e83c114fee4e242d1e9062eda9d03fb0d";

export interface BServicesUserMinimal {
  fcmtoken: string;
  is_iOS: boolean;
}

export async function fetchUserTokenAndPlatform(userId: string): Promise<BServicesUserMinimal> {
  const url = `https://bservices-api.org.pk/api/users/${encodeURIComponent(userId)}?includeDevices=true`;

  const response = await fetch(url, {
    headers: {
      "x-api-key": B_SERVICES_API_KEY,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user data: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Since only active devices are present, access the first device directly
  const activeDevice = data.devices[0];

  if (!activeDevice) {
    throw new Error("No active device found for the user");
  }

  // Ensure we return the FCM token from the active device
  const result: BServicesUserMinimal = {
    fcmtoken: activeDevice.fcmtoken,  // FCM token from the first active device
    is_iOS: activeDevice.is_iOS,      // iOS platform flag from the first active device
  };

  if (!result.fcmtoken) {
    throw new Error("FCM token is missing in active device data");
  }

  return result;
}
