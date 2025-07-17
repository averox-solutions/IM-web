export default class IdentityAuthClient {
    /**
     * Resets the 2FA secret for the current user by calling the /2fa/reset endpoint.
     * Fetches the username from localStorage (mx_user_id).
     * @returns The new secret, otpauth_url, qr, and message from the server.
     */
    public async reset2FA(): Promise<{
        secret: string;
        otpauth_url: string;
        qr: string;
        message: string;
    }> {
        const username = localStorage.getItem("mx_user_id");
        if (!username) {
            throw new Error("mx_user_id not found in localStorage");
        }
        const TWO_FA_API_KEY = "cd61775633b58a3f6c630d7a15e335f6";
        const response = await fetch("/2fa/reset", {
            method: "POST",
            headers: {
                "api-key": TWO_FA_API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ username }),
        });
        if (!response.ok) {
            throw new Error(`Failed to reset 2FA: ${response.statusText}`);
        }
        return response.json();
    }
}
