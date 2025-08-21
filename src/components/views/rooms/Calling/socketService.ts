/*
Copyright 2017-2024 New Vector Ltd.
Copyright 2016 Aviral Dasgupta

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { io, Socket } from "socket.io-client";
import CallService from "./callService";

class SocketService {
    private static socket: Socket | null = null;
    private static backendUrl: string = process.env.REACT_APP_BACKEND_URL || "http://localhost:3000";

    /**
     * Initialize the socket connection
     * @param userId - The ID of the current user
     * @returns The socket instance
     */
    public static initialize(userId: string): Socket {
        if (this.socket?.connected) {
            console.log(`Socket already connected to ${this.backendUrl}`);
            console.log("socket after connected", this.socket);
            this.socket.disconnect();
        }

        console.log(`Initializing socket connection to ${this.backendUrl} for user ${userId}`);

        this.socket = io(this.backendUrl, {
            withCredentials: true,
            auth: {
                "x-api-key": "3a7520ec8dd5de7bf74e2f791b14167773cd747cf8f4f452f3f473251a1c803d",
            },
            extraHeaders: {
                "x-api-key": "3a7520ec8dd5de7bf74e2f791b14167773cd747cf8f4f452f3f473251a1c803d",
            },
            query: {
                "x-api-key": "3a7520ec8dd5de7bf74e2f791b14167773cd747cf8f4f452f3f473251a1c803d",
            },
            transports: ["websocket"],
        });

        // Set up connection event handlers
        this.socket.on("connect", () => {
            console.log(`Socket connected to ${this.backendUrl}`);
            console.log("socket after connect", this.socket);
            if (this.socket) {
                console.log(`Emitting ADD_USER event for ${userId}`);
                this.socket.emit("add_user", userId);
            }
        });

        this.socket.on("disconnect", () => {
            console.log("Socket disconnected");
        });

        this.socket.on("connect_error", (error) => {
            console.error("Socket connection error:", error);
        });

        // Initialize CallService with the socket
        CallService.initialize(this.socket);

        console.log("Connecting socket...");
        this.socket.connect();
        return this.socket;
    }

    /**
     * Get the current socket instance
     * @returns The socket instance or null if not initialized
     */
    public static getSocket(): Socket | null {
        return this.socket;
    }

    /**
     * Disconnect the socket
     */
    public static disconnect(): void {
        if (this.socket?.connected) {
            console.log("Disconnecting socket...");
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /**
     * Emit an event to the socket server with a Promise-based response
     * @param event - The event name
     * @param data - The data to send
     * @param timeout - Optional timeout in milliseconds
     * @returns A promise that resolves to the response
     */
    public static emitAsync<T>(event: string, data: any, timeout: number = 5000): Promise<T> {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error("Socket not initialized"));
                return;
            }

            console.log(`Emitting async event: ${event}`, data);

            // Set up timeout
            const timeoutId = setTimeout(() => {
                reject(new Error(`Timeout waiting for ${event} response`));
            }, timeout);

            this.socket.emit(event, data, (response: T) => {
                clearTimeout(timeoutId);
                console.log(`Received response for ${event}:`, response);
                if (response && (response as any).error) {
                    reject((response as any).error);
                } else {
                    resolve(response);
                }
            });
        });
    }
}

export default SocketService;
