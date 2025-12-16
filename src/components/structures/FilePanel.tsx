/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import {
    Filter,
    type EventTimelineSet,
    type IRoomTimelineData,
    type Direction,
    type MatrixEvent,
    MatrixEventEvent,
    type Room,
    RoomEvent,
    type TimelineWindow,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import FilesIcon from "@vector-im/compound-design-tokens/assets/web/icons/files";

import { MatrixClientPeg } from "../../MatrixClientPeg";
import EventIndexPeg from "../../indexing/EventIndexPeg";
import { _t } from "../../languageHandler";
import SearchWarning, { WarningKind } from "../views/elements/SearchWarning";
import BaseCard from "../views/right_panel/BaseCard";
import type ResizeNotifier from "../../utils/ResizeNotifier";
import TimelinePanel from "./TimelinePanel";
import Spinner from "../views/elements/Spinner";
import { Layout } from "../../settings/enums/Layout";
import RoomContext, { TimelineRenderingType } from "../../contexts/RoomContext";
import Measured from "../views/elements/Measured";
import EmptyState from "../views/right_panel/EmptyState";
import { ScopedRoomContextProvider } from "../../contexts/ScopedRoomContext";

interface IProps {
    roomId: string;
    onClose: () => void;
    resizeNotifier: ResizeNotifier;
}

interface IState {
    timelineSet: EventTimelineSet | null;
    narrow: boolean;
    // Store file events in component state for persistence
    fileEvents: MatrixEvent[];
    isLoadingFiles: boolean;
}

/*
 * Component which shows the filtered file using a TimelinePanel
 */
class FilePanel extends React.Component<IProps, IState> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    // Track events that are being decrypted and whether they belong at the
    // start of the timeline (historical pagination) or end (live).
    private decryptingEvents = new Map<string, boolean>();
    // Count of file-like events added during current session to allow early stop
    private loadedFilesCount = 0;
    public noRoom = false;
    private card = createRef<HTMLDivElement>();

    public state: IState = {
        timelineSet: null,
        narrow: false,
        fileEvents: [],
        isLoadingFiles: false,
    };

    private onRoomTimeline = (
        ev: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        if (room?.roomId !== this.props.roomId) return;
        if (ev.isRedacted()) return;

        const client = MatrixClientPeg.safeGet();
        const isEncryptedRoom = client.isRoomEncrypted(this.props.roomId);

        // For unencrypted rooms, the filtered timeline handles files via server-side filter
        if (!isEncryptedRoom) return;

        // In encrypted rooms, process both live events and backfilled events so the Files
        // panel shows items even without the Event Index.
        client.decryptEventIfNeeded(ev);

        if (ev.isBeingDecrypted()) {
            this.decryptingEvents.set(ev.getId()!, Boolean(toStartOfTimeline));
        } else {
            this.addEncryptedLiveOrHistoricalEvent(ev, Boolean(toStartOfTimeline));
        }
    };

    private onEventDecrypted = (ev: MatrixEvent, err?: any): void => {
        if (ev.getRoomId() !== this.props.roomId) return;
        const eventId = ev.getId()!;

        if (!this.decryptingEvents.has(eventId)) return;
        const toStartOfTimeline = this.decryptingEvents.get(eventId)!;
        this.decryptingEvents.delete(eventId);
        if (err) return;

        this.addEncryptedLiveOrHistoricalEvent(ev, toStartOfTimeline);
    };

    public addEncryptedLiveOrHistoricalEvent(ev: MatrixEvent, toStartOfTimeline: boolean): void {
        if (!this.state.timelineSet) return;

        const timeline = this.state.timelineSet.getLiveTimeline();
        if (ev.getType() !== "m.room.message") return;
        if (!["m.file", "m.image", "m.video", "m.audio"].includes(ev.getContent().msgtype!)) {
            return;
        }

        // Add to timeline set
        if (!this.state.timelineSet.eventIdToTimeline(ev.getId()!)) {
            this.state.timelineSet.addEventToTimeline(ev, timeline, {
                fromCache: false,
                addToState: false,
                toStartOfTimeline,
            });
            this.loadedFilesCount++;
        }

        // Also add to our persistent file events state
        const eventId = ev.getId()!;
        const existingIndex = this.state.fileEvents.findIndex(e => e.getId() === eventId);
        
        if (existingIndex === -1) {
            // New file event - add to state
            const newFileEvents = toStartOfTimeline 
                ? [ev, ...this.state.fileEvents]
                : [...this.state.fileEvents, ev];
            this.setState({ fileEvents: newFileEvents });
        }
    }

    public async componentDidMount(): Promise<void> {
        const client = MatrixClientPeg.safeGet();

        await this.updateTimelineSet(this.props.roomId);

        if (!client.isRoomEncrypted(this.props.roomId)) return;

        // Load all historical files for this room
        await this.loadAllHistoricalFiles();

        // The timelineSets filter makes sure that encrypted events that contain
        // URLs never get added to the timeline, even if they are live events.
        // These methods manually listen for such events and add them despite the
        // filter's best efforts. We attach these listeners for encrypted rooms
        // regardless of whether an event index is available, so that new uploads
        // appear immediately in the Files tab.
        client.on(RoomEvent.Timeline, this.onRoomTimeline);
        client.on(MatrixEventEvent.Decrypted, this.onEventDecrypted);
    }

    public componentWillUnmount(): void {
        const client = MatrixClientPeg.get();
        if (client === null) return;

        if (!client.isRoomEncrypted(this.props.roomId)) return;

        client.removeListener(RoomEvent.Timeline, this.onRoomTimeline);
        client.removeListener(MatrixEventEvent.Decrypted, this.onEventDecrypted);
    }

    public async fetchFileEventsServer(room: Room): Promise<EventTimelineSet> {
        const client = MatrixClientPeg.safeGet();

        const filter = new Filter(client.getSafeUserId());
        filter.setDefinition({
            room: {
                timeline: {
                    contains_url: true,
                    types: ["m.room.message"],
                },
            },
        });

        filter.filterId = await client.getOrCreateFilter("FILTER_FILES_" + client.credentials.userId, filter);
        return room.getOrCreateFilteredTimelineSet(filter);
    }

    private onPaginationRequest = (
        timelineWindow: TimelineWindow,
        direction: Direction,
        limit: number,
    ): Promise<boolean> => {
        const client = MatrixClientPeg.safeGet();
        const eventIndex = EventIndexPeg.get();
        const roomId = this.props.roomId;

        const room = client.getRoom(roomId);

        // We override the pagination request for encrypted rooms so that we ask
        // the event index to fulfill the pagination request. Asking the server
        // to paginate won't ever work since the server can't correctly filter
        // out events containing URLs
        if (room && client.isRoomEncrypted(roomId) && eventIndex !== null) {
            return eventIndex.paginateTimelineWindow(room, timelineWindow, direction, limit);
        } else {
            return timelineWindow.paginate(direction, limit);
        }
    };

    private onMeasurement = (narrow: boolean): void => {
        this.setState({ narrow });
    };

    public async updateTimelineSet(roomId: string): Promise<void> {
        const client = MatrixClientPeg.safeGet();
        const room = client.getRoom(roomId);
        const eventIndex = EventIndexPeg.get();

        this.noRoom = !room;

        if (room) {
            let timelineSet;

            try {
                timelineSet = await this.fetchFileEventsServer(room);

                // If this room is encrypted the file panel won't be populated
                // correctly since the defined filter doesn't support encrypted
                // events and the server can't check if encrypted events contain
                // URLs.
                //
                // This is where our event index comes into place, we ask the
                // event index to populate the timelineSet for us. This call
                // will add 10 events to the live timeline of the set. More can
                // be requested using pagination.
                if (client.isRoomEncrypted(roomId) && eventIndex !== null) {
                    const timeline = timelineSet.getLiveTimeline();
                    await eventIndex.populateFileTimeline(timelineSet, timeline, room, 10);
                }

                this.loadedFilesCount = 0;
                this.setState({ timelineSet: timelineSet });
            } catch (error) {
                logger.error("Failed to get or create file panel filter", error);
            }
        } else {
            logger.error("Failed to add filtered timelineSet for FilePanel as no room!");
        }
    }

    private async loadAllHistoricalFiles(): Promise<void> {
        const client = MatrixClientPeg.safeGet();
        const room = client.getRoom(this.props.roomId);
        if (!room) return;

        this.setState({ isLoadingFiles: true });

        try {
            const allFileEvents: MatrixEvent[] = [];
            
            // First, collect all currently loaded events
            const liveEvents = room.getLiveTimeline().getEvents();
            for (const ev of liveEvents) {
                if (this.isFileEvent(ev)) {
                    allFileEvents.push(ev);
                }
            }

            // Then paginate backwards to get historical files
            const CHUNK = 100;
            const MAX_CHUNKS = 20; // Load up to 2000 events worth of history
            
            for (let i = 0; i < MAX_CHUNKS; i++) {
                const gotMore = await client.paginateEventTimeline(room.getLiveTimeline(), {
                    backwards: true,
                    limit: CHUNK,
                });
                
                if (!gotMore) break;
                
                // Process newly loaded events
                const newEvents = room.getLiveTimeline().getEvents();
                for (const ev of newEvents) {
                    if (this.isFileEvent(ev) && !allFileEvents.find(e => e.getId() === ev.getId())) {
                        allFileEvents.push(ev);
                    }
                }
            }

            // Sort by timestamp (newest first)
            allFileEvents.sort((a, b) => b.getTs() - a.getTs());

            // Update state with all found files
            console.log(`FilePanel: Found ${allFileEvents.length} files for room ${this.props.roomId}`);
            this.setState({ 
                fileEvents: allFileEvents,
                isLoadingFiles: false 
            });

            // Add all files to the timeline set
            for (const ev of allFileEvents) {
                this.addEncryptedLiveOrHistoricalEvent(ev, false);
            }

            // Force update to ensure the count is displayed correctly
            this.forceUpdate();

        } catch (e) {
            logger.warn("FilePanel loadAllHistoricalFiles failed", e);
            this.setState({ isLoadingFiles: false });
        }
    }

    private isFileEvent(ev: MatrixEvent): boolean {
        if (ev.getType() !== "m.room.message") return false;
        if (ev.isRedacted()) return false;
        
        const content = ev.getContent();
        return ["m.file", "m.image", "m.video", "m.audio"].includes(content.msgtype!);
    }


    public render(): React.ReactNode {
        if (MatrixClientPeg.safeGet().isGuest()) {
            return (
                <BaseCard
                    className="mx_FilePanel mx_RoomView_messageListWrapper"
                    onClose={this.props.onClose}
                    header={_t("right_panel|files_button")}
                >
                    <div className="mx_RoomView_empty">
                        {_t(
                            "file_panel|guest_note",
                            {},
                            {
                                a: (sub) => (
                                    <a href="#/register" key="sub">
                                        {sub}
                                    </a>
                                ),
                            },
                        )}
                    </div>
                </BaseCard>
            );
        } else if (this.noRoom) {
            return (
                <BaseCard
                    className="mx_FilePanel mx_RoomView_messageListWrapper"
                    onClose={this.props.onClose}
                    header={_t("right_panel|files_button")}
                >
                    <div className="mx_RoomView_empty">{_t("file_panel|peek_note")}</div>
                </BaseCard>
            );
        }

        // wrap a TimelinePanel with the jump-to-event bits turned off.

        const emptyState = (
            <EmptyState
                Icon={FilesIcon}
                title={_t("file_panel|empty_heading")}
                description={_t("file_panel|empty_description")}
            />
        );

        const isRoomEncrypted = this.noRoom ? false : MatrixClientPeg.safeGet().isRoomEncrypted(this.props.roomId);

        if (this.state.timelineSet) {
            // Show loading state in header; do not show numeric counts
            const headerText = this.state.isLoadingFiles
                ? `${_t("right_panel|files_button")} (Loading...)`
                : _t("right_panel|files_button");

            return (
                <ScopedRoomContextProvider
                    {...this.context}
                    timelineRenderingType={TimelineRenderingType.File}
                    narrow={this.state.narrow}
                >
                    <BaseCard
                        className="mx_FilePanel"
                        onClose={this.props.onClose}
                        withoutScrollContainer
                        ref={this.card}
                        header={headerText}
                    >
                        <Measured sensor={this.card} onMeasurement={this.onMeasurement} />
                        <SearchWarning isRoomEncrypted={isRoomEncrypted} kind={WarningKind.Files} />
                        {this.state.isLoadingFiles ? (
                            <div style={{ padding: '20px', textAlign: 'center' }}>
                                <Spinner />
                                <div style={{ marginTop: '10px' }}>Loading files...</div>
                            </div>
                        ) : (
                            <TimelinePanel
                                manageReadReceipts={false}
                                manageReadMarkers={false}
                                timelineSet={this.state.timelineSet}
                                showUrlPreview={false}
                                onPaginationRequest={this.onPaginationRequest}
                                resizeNotifier={this.props.resizeNotifier}
                                empty={emptyState}
                                layout={Layout.Group}
                            />
                        )}
                    </BaseCard>
                </ScopedRoomContextProvider>
            );
        } else {
            return (
                <ScopedRoomContextProvider {...this.context} timelineRenderingType={TimelineRenderingType.File}>
                    <BaseCard
                        className="mx_FilePanel"
                        onClose={this.props.onClose}
                        header={_t("right_panel|files_button")}
                    >
                        <Spinner />
                    </BaseCard>
                </ScopedRoomContextProvider>
            );
        }
    }
}

export default FilePanel;