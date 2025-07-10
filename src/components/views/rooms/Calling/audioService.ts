class AudioService {
    private static incomingCallSound: HTMLAudioElement | null = null;
    private static outgoingCallSound: HTMLAudioElement | null = null;
    private static callEndSound: HTMLAudioElement | null = null;

    public static initialize() {
        // Create audio elements if they don't exist
        if (!this.incomingCallSound) {
            this.incomingCallSound = new Audio('/sounds/ring.mp3');
            this.incomingCallSound.loop = true;
        }

        if (!this.outgoingCallSound) {
            this.outgoingCallSound = new Audio('/sounds/ringback.mp3');
            this.outgoingCallSound.loop = true;
        }

        if (!this.callEndSound) {
            this.callEndSound = new Audio('/sounds/callend.mp3');
            this.callEndSound.loop = false;
        }
    }

    public static playIncomingCall() {
        this.stopAll();
        this.incomingCallSound?.play().catch(error => {
            console.warn('Error playing incoming call sound:', error);
        });
    }

    public static playOutgoingCall() {
        this.stopAll();
        this.outgoingCallSound?.play().catch(error => {
            console.warn('Error playing outgoing call sound:', error);
        });
    }

    public static playCallEnd() {
        this.stopAll();
        this.callEndSound?.play().catch(error => {
            console.warn('Error playing call end sound:', error);
        });
    }

    public static stopAll() {
        if (this.incomingCallSound) {
            this.incomingCallSound.pause();
            this.incomingCallSound.currentTime = 0;
        }

        if (this.outgoingCallSound) {
            this.outgoingCallSound.pause();
            this.outgoingCallSound.currentTime = 0;
        }

        if (this.callEndSound) {
            this.callEndSound.pause();
            this.callEndSound.currentTime = 0;
        }
    }
}

export default AudioService; 