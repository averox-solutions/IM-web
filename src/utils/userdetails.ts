import fetch from "node-fetch";

const B_SERVICES_API_KEY = "dd567d9dc413ba272f5c418640a53c1ed89cce360b6e28af93f7c422dd0aaa16";

export interface BServicesUserMinimal {
  fcmtoken: string;
  is_iOS: boolean;
}

export async function fetchUserTokenAndPlatform(userId: string): Promise<BServicesUserMinimal> {
  const url = `https://bservices-api.org.pk/api/users/${encodeURIComponent(userId)}`;

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

  const result: BServicesUserMinimal = {
    fcmtoken: data.fcmtoken,
    is_iOS: data.is_iOS,
  };

  if (!result.fcmtoken) {
    throw new Error("FCM token is missing in user data");
  }

  return result;
}
