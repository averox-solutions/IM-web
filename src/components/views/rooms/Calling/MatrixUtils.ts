import { MatrixClientPeg } from "../../../../MatrixClientPeg";

/**
 * Get the current Matrix user ID
 * @returns The user ID without @ and server part, or null if not logged in
 */
export function getCurrentMatrixUserId(): string | null {
    const matrixClient = MatrixClientPeg.get();
    if (!matrixClient) return null;
    
    const fullUserId = matrixClient.getUserId();
    if (!fullUserId) return null;
    
    // Extract just the username part (remove @ and server)
    // e.g., @user:matrix.org -> user
    // return fullUserId.replace(/^@/, '').split(':')[0];
    return fullUserId;
}

/**
 * Get the display name for a Matrix user
 * @param userId - The full Matrix user ID (@user:matrix.org)
 * @returns The display name or userId if not found
 */
export function getMatrixDisplayName(userId: string): string {
    const matrixClient = MatrixClientPeg.get();
    if (!matrixClient) return userId;
    
    try {
        const user = matrixClient.getUser(userId);
        if (user) {
            return user.displayName || userId;
        }
    } catch (e) {
        console.error('Error getting display name for', userId, e);
    }
    
    return userId;
}

/**
 * Get information about the current Matrix room
 * @returns Room information or null if not in a room
 */
export function getCurrentRoomInfo(): { roomId: string, roomName: string } | null {
    const matrixClient = MatrixClientPeg.get();
    if (!matrixClient) return null;
    
    try {
        const activeRoomId = window.location.hash.match(/\#\/room\/([^/]+)/)?.[1];
        if (!activeRoomId) return null;
        
        const room = matrixClient.getRoom(activeRoomId);
        if (!room) return null;
        
        return {
            roomId: activeRoomId,
            roomName: room.name
        };
    } catch (e) {
        console.error('Error getting room info', e);
        return null;
    }
}

/**
 * Get members of the current Matrix room
 * @returns Array of room members or empty array if not in a room
 */
export function getCurrentRoomMembers(): { userId: string, displayName: string }[] {
    const matrixClient = MatrixClientPeg.get();
    if (!matrixClient) return [];
    
    try {
        const activeRoomId = window.location.hash.match(/\#\/room\/([^/]+)/)?.[1];
        if (!activeRoomId) return [];
        
        const room = matrixClient.getRoom(activeRoomId);
        if (!room) return [];
        
        const members = room.getJoinedMembers();
        return members.map(member => ({
            userId: member.userId,
            displayName: member.name || member.userId
        }));
    } catch (e) {
        console.error('Error getting room members', e);
        return [];
    }
} 