/**
 * Utility functions for displaying notifications without using Antd
 */

/**
 * Show a simple toast notification on the page
 * @param message - The message to show
 * @param type - The type of notification (info, success, error, warning)
 * @param duration - How long to show the notification (in milliseconds)
 */
export function showToast(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info', duration: number = 3000): void {
    // Create toast element
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '4px';
    toast.style.zIndex = '10000';
    toast.style.maxWidth = '300px';
    toast.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    toast.style.animation = 'fadeIn 0.3s, fadeOut 0.3s ' + (duration - 300) + 'ms';
    
    // Add styles based on type
    switch (type) {
        case 'success':
            toast.style.backgroundColor = '#f6ffed';
            toast.style.border = '1px solid #b7eb8f';
            toast.style.color = '#52c41a';
            break;
        case 'error':
            toast.style.backgroundColor = '#fff2f0';
            toast.style.border = '1px solid #ffccc7';
            toast.style.color = '#ff4d4f';
            break;
        case 'warning':
            toast.style.backgroundColor = '#fffbe6';
            toast.style.border = '1px solid #ffe58f';
            toast.style.color = '#faad14';
            break;
        case 'info':
        default:
            toast.style.backgroundColor = '#e6f7ff';
            toast.style.border = '1px solid #91d5ff';
            toast.style.color = '#1890ff';
            break;
    }

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-20px); }
        }
    `;
    document.head.appendChild(style);
    
    // Add to DOM
    document.body.appendChild(toast);
    
    // Remove after duration
    setTimeout(() => {
        document.body.removeChild(toast);
        document.head.removeChild(style);
    }, duration);
}

/**
 * Show a notification for an incoming call
 * @param roomId - The room ID
 * @param fromUsername - The username of the caller
 * @param isVideo - Whether it's a video call
 * @param callLogId - The call log ID
 * @param onAccept - Function to call when accepting
 * @param onReject - Function to call when rejecting
 */
export function showCallNotification(
    roomId: string,
    fromUsername: string,
    isVideo: boolean,
    callLogId: string,
    onAccept: () => void,
    onReject: () => void
): void {
    // Create notification element
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.padding = '15px';
    container.style.backgroundColor = 'white';
    container.style.borderRadius = '4px';
    container.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    container.style.zIndex = '10000';
    container.style.width = '300px';
    container.id = `call-${callLogId}`;
    
    // Add title
    const title = document.createElement('div');
    title.textContent = `Incoming ${isVideo ? 'Video' : 'Audio'} Call`;
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    title.style.color = '#1890ff';
    container.appendChild(title);
    
    // Add message
    const message = document.createElement('div');
    message.textContent = `${fromUsername} is calling you`;
    message.style.marginBottom = '12px';
    container.appendChild(message);
    
    // Add buttons container
    const buttons = document.createElement('div');
    buttons.style.display = 'flex';
    buttons.style.justifyContent = 'space-between';
    container.appendChild(buttons);
    
    // Add accept button
    const acceptButton = document.createElement('button');
    acceptButton.textContent = 'Accept';
    acceptButton.style.padding = '5px 15px';
    acceptButton.style.backgroundColor = '#52c41a';
    acceptButton.style.color = 'white';
    acceptButton.style.border = 'none';
    acceptButton.style.borderRadius = '4px';
    acceptButton.style.cursor = 'pointer';
    acceptButton.onclick = () => {
        document.body.removeChild(container);
        onAccept();
    };
    buttons.appendChild(acceptButton);
    
    // Add reject button
    const rejectButton = document.createElement('button');
    rejectButton.textContent = 'Reject';
    rejectButton.style.padding = '5px 15px';
    rejectButton.style.backgroundColor = '#ff4d4f';
    rejectButton.style.color = 'white';
    rejectButton.style.border = 'none';
    rejectButton.style.borderRadius = '4px';
    rejectButton.style.cursor = 'pointer';
    rejectButton.onclick = () => {
        document.body.removeChild(container);
        onReject();
    };
    buttons.appendChild(rejectButton);
    
    // Add to DOM
    document.body.appendChild(container);
}

/**
 * Close a call notification
 * @param callId - The call ID
 */
export function closeCallNotification(callId: string): void {
    const notification = document.getElementById(`call-${callId}`);
    if (notification) {
        document.body.removeChild(notification);
    }
} 