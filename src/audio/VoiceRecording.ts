/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SimpleObservable } from "matrix-widget-api";
import EventEmitter from "events";
import { logger } from "matrix-js-sdk/src/logger";
// @ts-ignore - we know that this is not a module. We're looking for a path.
import wavEncoderPath from "opus-recorder/dist/waveWorker.min.js";

import MediaDeviceHandler from "../MediaDeviceHandler";
import { type IDestroyable } from "../utils/IDestroyable";
import { Singleflight } from "../utils/Singleflight";
import { PayloadEvent, WORKLET_NAME } from "./consts";
import { UPDATE_EVENT } from "../stores/AsyncStore";
import { createAudioContext } from "./compat";
import { FixedRollingArray } from "../utils/FixedRollingArray";
import { clamp } from "../utils/numbers";
import recorderWorkletFactory from "./recorderWorkletFactory";

const CHANNELS = 1; // Use mono for WAV recording
export const SAMPLE_RATE = 44100; // 44.1kHz sample rate
const TARGET_MAX_LENGTH = 900; // 15 minutes in seconds. Somewhat arbitrary, though longer == larger files.
const TARGET_WARN_TIME_LEFT = 10; // 10 seconds, also somewhat arbitrary.

export const RECORDING_PLAYBACK_SAMPLES = 44;

export interface IRecordingUpdate {
    waveform: number[]; // floating points between 0 (low) and 1 (high).
    timeSeconds: number; // float
}

export enum RecordingState {
    Started = "started",
    Paused = "paused",
    EndingSoon = "ending_soon", // emits an object with a single numerical value: secondsLeft
    Ended = "ended",
    Uploading = "uploading",
    Uploaded = "uploaded",
}

export class VoiceRecording extends EventEmitter implements IDestroyable {
    private recorderContext?: AudioContext;
    private recorderSource?: MediaStreamAudioSourceNode;
    private recorderStream?: MediaStream;
    private recorderWorklet?: AudioWorkletNode;
    private recorderProcessor?: ScriptProcessorNode;
    private recording = false;
    private paused = false;
    private observable?: SimpleObservable<IRecordingUpdate>;
    private targetMaxLength: number | null = TARGET_MAX_LENGTH;
    public amplitudes: number[] = []; // at each second mark, generated
    private liveWaveform = new FixedRollingArray(RECORDING_PLAYBACK_SAMPLES, 0);
    public onDataAvailable?: (data: ArrayBuffer) => void;
    private wavWorker?: Worker;
    private pcmBuffers: Float32Array[] = [];
    private recordingDuration = 0;

    public get contentType(): string {
        return "audio/wav";
    }

    public get codec(): string {
        return "pcm_s16le"; // Standard PCM 16-bit little-endian codec identifier
    }

    public get container(): string {
        return "WAV";
    }

    public get durationSeconds(): number {
        if (!this.recorderContext) throw new Error("Duration not available without a recording");
        return this.recordingDuration;
    }

    public get isRecording(): boolean {
        return this.recording;
    }

    public get isPaused(): boolean {
        return this.paused;
    }

    public emit(event: string, ...args: any[]): boolean {
        super.emit(event, ...args);
        super.emit(UPDATE_EVENT, event, ...args);
        return true; // we don't ever care if the event had listeners, so just return "yes"
    }

    public disableMaxLength(): void {
        this.targetMaxLength = null;
    }

    private async setupWavRecorder(): Promise<void> {
        // Set up AudioContext for PCM capture and waveform analysis
        this.recorderContext = createAudioContext({
            sampleRate: SAMPLE_RATE,
        });
        this.recorderSource = this.recorderContext.createMediaStreamSource(this.recorderStream!);

        // Initialize WAV encoder worker
        this.wavWorker = new Worker(wavEncoderPath);
        this.pcmBuffers = [];

        // Initialize WAV encoder with settings
        this.wavWorker.postMessage({
            command: "init",
            wavBitDepth: 16, // 16-bit PCM for WAV
            wavSampleRate: SAMPLE_RATE,
        });

        // Handle WAV encoder messages
        this.wavWorker.onmessage = (ev) => {
            if (ev.data.message === "page") {
                // WAV data is ready - this is the complete WAV file
                const wavBuffer = ev.data.page;
                logger.log(`WAV encoding complete, buffer size: ${wavBuffer.byteLength} bytes`);
                this.onDataAvailable?.(wavBuffer);
            } else if (ev.data.message === "done") {
                logger.log("WAV encoder finished");
            }
        };

        // Set up worklet/processor for waveform analysis and PCM capture
        if (this.recorderContext.audioWorklet) {
            await recorderWorkletFactory(this.recorderContext);
            this.recorderWorklet = new AudioWorkletNode(this.recorderContext, WORKLET_NAME);
            this.recorderSource.connect(this.recorderWorklet);
            this.recorderWorklet.connect(this.recorderContext.destination);

            this.recorderWorklet.port.onmessage = (ev) => {
                // Validate message shape before accessing properties
                if (!ev.data || typeof ev.data !== "object") return;
                
                switch (ev.data["ev"]) {
                    case PayloadEvent.Timekeep:
                        if (typeof ev.data["timeSeconds"] === "number") {
                            this.recordingDuration = ev.data["timeSeconds"];
                            this.processAudioUpdate(ev.data["timeSeconds"]);
                        }
                        break;
                    case PayloadEvent.AmplitudeMark:
                        if (
                            typeof ev.data["forIndex"] === "number" &&
                            typeof ev.data["amplitude"] === "number" &&
                            ev.data["forIndex"] === this.amplitudes.length
                        ) {
                            this.amplitudes.push(ev.data["amplitude"]);
                            this.liveWaveform.pushValue(ev.data["amplitude"]);
                        }
                        break;
                }
            };

            // Also use ScriptProcessorNode to capture PCM data for WAV encoding
            // (worklet is for timing/waveform, we need ScriptProcessor for PCM capture)
            this.recorderProcessor = this.recorderContext.createScriptProcessor(4096, CHANNELS, CHANNELS);
            this.recorderSource.connect(this.recorderProcessor);
            this.recorderProcessor.connect(this.recorderContext.destination);
            this.recorderProcessor.addEventListener("audioprocess", this.onAudioProcess);
        } else {
            // Safari fallback: use a processor node for PCM capture
            this.recorderProcessor = this.recorderContext.createScriptProcessor(4096, CHANNELS, CHANNELS);
            this.recorderSource.connect(this.recorderProcessor);
            this.recorderProcessor.connect(this.recorderContext.destination);
            this.recorderProcessor.addEventListener("audioprocess", this.onAudioProcess);
        }
    }

    private async makeRecorder(): Promise<void> {
        try {
            // Build audio constraints for WAV recording: mono, 44.1kHz
            const audioConstraints: MediaTrackConstraints = {
                deviceId: MediaDeviceHandler.getAudioInput(),
                autoGainControl: { ideal: MediaDeviceHandler.getAudioAutoGainControl() },
                echoCancellation: { ideal: MediaDeviceHandler.getAudioEchoCancellation() },
                noiseSuppression: { ideal: MediaDeviceHandler.getAudioNoiseSuppression() },
                channelCount: { ideal: CHANNELS },
                sampleRate: { ideal: SAMPLE_RATE },
            };
            
            this.recorderStream = await navigator.mediaDevices.getUserMedia({
                audio: audioConstraints,
            });
            
            await this.setupWavRecorder();
        } catch (e) {
            logger.error("Error starting recording: ", e);
            if (e instanceof DOMException) {
                // Unhelpful DOMExceptions are common - parse them sanely
                logger.error(`${e.name} (${e.code}): ${e.message}`);
                
                // Provide more helpful error messages for common issues
                if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
                    logger.error("Microphone permission denied. User needs to grant microphone access in browser settings.");
                } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
                    logger.error("No microphone found. Please connect a microphone and try again.");
                } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
                    logger.error("Microphone is already in use by another application. Please close other apps using the microphone.");
                } else if (e.name === "OverconstrainedError" || e.name === "ConstraintNotSatisfiedError") {
                    logger.error("Microphone doesn't support requested constraints. Trying with relaxed constraints...");
                    // Try again with minimal constraints as fallback
                    try {
                        return await this.makeRecorderWithMinimalConstraints();
                    } catch (fallbackError) {
                        logger.error("Fallback recording attempt also failed:", fallbackError);
                        // Continue to cleanup and throw original error
                    }
                }
            }

            // Clean up as best as possible
            if (this.recorderStream) this.recorderStream.getTracks().forEach((t) => t.stop());
            if (this.recorderSource) this.recorderSource.disconnect();
            if (this.wavWorker) this.wavWorker.terminate();
            if (this.recorderContext) {
                // noinspection ES6MissingAwait - not important that we wait
                this.recorderContext.close();
            }

            throw e; // rethrow so upstream can handle it
        }
    }

    /**
     * Fallback method to try recording with minimal constraints if the main attempt fails
     */
    private async makeRecorderWithMinimalConstraints(): Promise<void> {
        logger.log("Attempting recording with minimal constraints as fallback");
        
        // Use minimal constraints - just request audio, no specific requirements
        const minimalConstraints: MediaTrackConstraints = {
            deviceId: MediaDeviceHandler.getAudioInput(),
        };
        
        this.recorderStream = await navigator.mediaDevices.getUserMedia({
            audio: minimalConstraints,
        });

        await this.setupWavRecorder();
    }

    public get liveData(): SimpleObservable<IRecordingUpdate> {
        if (!this.recording || !this.observable) throw new Error("No observable when not recording");
        return this.observable;
    }

    public get isSupported(): boolean {
        // WAV recording is supported if we can create an AudioContext and get user media
        return typeof AudioContext !== "undefined" || typeof (window as any).webkitAudioContext !== "undefined";
    }

    private onAudioProcess = (ev: AudioProcessingEvent): void => {
        if (!this.recording || this.paused) return;

        // Capture PCM data from the input buffer
        const inputBuffer = ev.inputBuffer;
        const channelData = inputBuffer.getChannelData(0); // Get mono channel
        
        // Create a copy of the channel data (don't transfer, we need to keep accumulating)
        const pcmData = new Float32Array(channelData.length);
        pcmData.set(channelData);
        this.pcmBuffers.push(pcmData);
        
        // Send PCM data to WAV encoder worker (copy the buffer, don't transfer)
        if (this.wavWorker) {
            const bufferCopy = new Float32Array(pcmData);
            this.wavWorker.postMessage(
                {
                    command: "encode",
                    buffers: [bufferCopy],
                },
                [bufferCopy.buffer], // Transfer the copy, keep original
            );
        }

        // Update recording duration and process audio update
        this.recordingDuration = ev.playbackTime;
        this.processAudioUpdate(ev.playbackTime);
    };

    private processAudioUpdate = (timeSeconds: number): void => {
        if (!this.recording || this.paused) return;

        this.observable!.update({
            waveform: this.liveWaveform.value.map((v) => clamp(v, 0, 1)),
            timeSeconds: timeSeconds,
        });

        // Now that we've updated the data/waveform, let's do a time check. We don't want to
        // go horribly over the limit. We also emit a warning state if needed.
        //
        // We use the recorder's perspective of time to make sure we don't cut off the last
        // frame of audio, otherwise we end up with a 14:59 clip (899.68 seconds). This extra
        // safety can allow us to overshoot the target a bit, but at least when we say 15min
        // maximum we actually mean it.
        //
        // In testing, recorder time and worker time lag by about 400ms, which is roughly the
        // time needed to encode a sample/frame.
        //

        if (!this.targetMaxLength) {
            // skip time checks if max length has been disabled
            return;
        }

        const recorderSeconds = this.recorderSeconds;
        if (recorderSeconds === undefined) return;
        
        const secondsLeft = TARGET_MAX_LENGTH - recorderSeconds;
        if (secondsLeft < 0) {
            // go over to make sure we definitely capture that last frame
            // noinspection JSIgnoredPromiseFromCall - we aren't concerned with it overlapping
            this.stop();
        } else if (secondsLeft <= TARGET_WARN_TIME_LEFT) {
            Singleflight.for(this, "ending_soon").do(() => {
                this.emit(RecordingState.EndingSoon, { secondsLeft });
                return Singleflight.Void;
            });
        }
    };

    /**
     * Get the recording duration in seconds
     */
    public get recorderSeconds(): number | undefined {
        return this.recordingDuration > 0 ? this.recordingDuration : undefined;
    }

    public async start(): Promise<void> {
        if (this.recording) {
            throw new Error("Recording already in progress");
        }
        if (this.observable) {
            this.observable.close();
        }
        this.observable = new SimpleObservable<IRecordingUpdate>();
        this.recordingDuration = 0;
        this.pcmBuffers = [];
        await this.makeRecorder();
        
        this.recording = true;
        this.emit(RecordingState.Started);
    }

    public async stop(): Promise<void> {
        return Singleflight.for(this, "stop").do(async (): Promise<void> => {
            if (!this.recording) {
                throw new Error("No recording to stop");
            }

            logger.log(`Stopping recording, captured ${this.pcmBuffers.length} PCM buffers`);

            // Disconnect audio processing first to stop capturing new data
            if (this.recorderSource) this.recorderSource.disconnect();
            if (this.recorderWorklet) this.recorderWorklet.disconnect();
            if (this.recorderProcessor) {
                this.recorderProcessor.disconnect();
                this.recorderProcessor.removeEventListener("audioprocess", this.onAudioProcess);
            }

            // Finalize WAV encoding and wait for it to complete
            if (this.wavWorker) {
                const worker = this.wavWorker;
                await new Promise<void>((resolve) => {
                    // Listen for the final WAV file
                    const originalHandler = worker.onmessage;
                    worker.onmessage = (ev) => {
                        // Call original handler
                        if (originalHandler) {
                            originalHandler.call(worker, ev);
                        }
                        
                        // Wait for "page" message which contains the final WAV file
                        if (ev.data.message === "page") {
                            logger.log("Final WAV file received");
                            resolve();
                        }
                    };

                    // Tell worker to finalize and produce the WAV file
                    worker.postMessage({ command: "done" });

                    // Timeout after 5 seconds
                    setTimeout(() => {
                        logger.warn("WAV encoding timed out");
                        resolve();
                    }, 5000);
                });
            }

            // close the context after the recorder so the recorder doesn't try to
            // connect anything to the context (this would generate a warning)
            if (this.recorderContext) {
                await this.recorderContext.close().catch(() => {
                    // Best-effort cleanup; ignore errors
                });
            }

            // Now stop all the media tracks so we can release them back to the user/OS
            if (this.recorderStream) {
                this.recorderStream.getTracks().forEach((t) => t.stop());
            }

            // Terminate WAV worker
            if (this.wavWorker) {
                this.wavWorker.terminate();
                this.wavWorker = undefined;
            }

            // Finally do our post-processing and clean up
            this.recording = false;
            this.paused = false;
            this.pcmBuffers = [];
            this.emit(RecordingState.Ended);
        });
    }

    public async pauseRecording(): Promise<void> {
        if (!this.recording || this.paused) {
            throw new Error("Cannot pause: not recording or already paused");
        }
    
        // Suspend the AudioContext so time/worklet updates stop advancing
        if (this.recorderContext) {
            await this.recorderContext.suspend();
        }
    
        this.paused = true;
        this.emit(RecordingState.Paused);
    }
    
    public async resumeRecording(): Promise<void> {
        if (!this.recording || !this.paused) {
            throw new Error("Cannot resume: not recording or not paused");
        }
    
        // Resume audio clock first so the graph is running again
        if (this.recorderContext) {
            await this.recorderContext.resume();
        }
    
        this.paused = false;
        this.emit(RecordingState.Started);
    }
    

    /**
     * Best-effort cleanup. Calls stop() but doesn't wait for it to complete.
     * This is intentional to allow cleanup even if stop() fails.
     */
    public destroy(): void {
        Singleflight.forgetAllFor(this);
        this.removeAllListeners();
        this.onDataAvailable = undefined;
        this.observable?.close();
        // Best-effort stop; handle errors silently
        this.stop().catch(() => {
            // Ignore errors during cleanup
        });
    }
}
