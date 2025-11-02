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
        const TWO_FA_API_KEY = process.env.REACT_APP_2FA_API_KEY;
        const TWO_FA_URL = process.env.REACT_APP_2FA_URL;
        
        if (!TWO_FA_API_KEY || !TWO_FA_URL) {
            throw new Error("2FA configuration is missing. Please check environment variables.");
        }
        
        const response = await fetch(`${TWO_FA_URL}/2fa/reset`, {
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
