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
    public noRoom = false;
    private card = createRef<HTMLDivElement>();
    private timelinePanel = createRef<TimelinePanel>();

    public state: IState = {
        timelineSet: null,
        narrow: false,
    };

    private isFileEvent(ev: MatrixEvent): boolean {
        if (ev.getType() !== "m.room.message") return false;
        const content = ev.getContent();
        const msgtype = content.msgtype;
        // Check for file/media message types
        if (["m.file", "m.image", "m.video", "m.audio"].includes(msgtype)) {
            return true;
        }
        // Also check if the event has a URL (for media uploads)
        if (typeof content.url === "string" && content.url) {
            return true;
        }
        return false;
    }

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

        // For encrypted rooms, decrypt first
        if (isEncryptedRoom) {
            client.decryptEventIfNeeded(ev);
            if (ev.isBeingDecrypted()) {
                this.decryptingEvents.set(ev.getId()!, Boolean(toStartOfTimeline));
                return;
            }
        }

        // Check if this is a file/media event and add it to the timelineSet
        // This ensures new uploads appear immediately in both encrypted and unencrypted rooms
        if (this.isFileEvent(ev)) {
            this.addFileEventToTimeline(ev, Boolean(toStartOfTimeline));
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
        if (this.isFileEvent(ev)) {
            this.addFileEventToTimeline(ev, toStartOfTimeline);
        }
    }

    private addFileEventToTimeline(ev: MatrixEvent, toStartOfTimeline: boolean, timelineSet?: EventTimelineSet): void {
        const targetTimelineSet = timelineSet || this.state.timelineSet;
        if (!targetTimelineSet) return;

        const timeline = targetTimelineSet.getLiveTimeline();
        const eventId = ev.getId();
        if (!eventId) return;

        // Don't add if the event is already in the timelineSet
        if (!targetTimelineSet.eventIdToTimeline(eventId)) {
            targetTimelineSet.addEventToTimeline(ev, timeline, {
                fromCache: false,
                addToState: false,
                toStartOfTimeline,
            });
        }
    }

    public async componentDidMount(): Promise<void> {
        const client = MatrixClientPeg.safeGet();

        await this.updateTimelineSet(this.props.roomId);

        // Listen for timeline events to add new file/media uploads immediately
        // This works for both encrypted and unencrypted rooms
        client.on(RoomEvent.Timeline, this.onRoomTimeline);
        
        // For encrypted rooms, also listen for decryption events
        if (client.isRoomEncrypted(this.props.roomId)) {
            client.on(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        }
    }

    public componentWillUnmount(): void {
        const client = MatrixClientPeg.get();
        if (client === null) return;

        client.removeListener(RoomEvent.Timeline, this.onRoomTimeline);
        
        // Only remove decryption listener if room is encrypted
        if (client.isRoomEncrypted(this.props.roomId)) {
            client.removeListener(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        }
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

                // For encrypted rooms without an event index, proactively backfill the
                // Files panel from currently loaded room timeline events.
                if (client.isRoomEncrypted(roomId) && eventIndex === null) {
                    const liveEvents = room.getLiveTimeline().getEvents();
                    for (const ev of liveEvents) {
                        // If event is encrypted, try to decrypt then add if it is a file-like message
                        client.decryptEventIfNeeded(ev);
                        if (!ev.isBeingDecrypted()) {
                            this.addEncryptedLiveOrHistoricalEvent(ev, false);
                        } else {
                            this.decryptingEvents.set(ev.getId()!, false);
                        }
                    }
                }

                // For unencrypted rooms, trigger initial pagination to load file events from server
                // This ensures files show up even after a page refresh
                // IMPORTANT: Do this BEFORE setting state so TimelinePanel loads with events
                if (!client.isRoomEncrypted(roomId)) {
                    // First, backfill from currently loaded events for immediate display
                    const liveEvents = room.getLiveTimeline().getEvents();
                    let backfilledCount = 0;
                    for (const ev of liveEvents) {
                        if (this.isFileEvent(ev)) {
                            this.addFileEventToTimeline(ev, false, timelineSet);
                            backfilledCount++;
                        }
                    }
                    logger.log(`FilePanel: Backfilled ${backfilledCount} file events from room timeline`);
                    
                    // Then trigger pagination to load file events from the server
                    // This ensures files persist after refresh
                    const liveTimeline = timelineSet.getLiveTimeline();
                    const eventsBeforePagination = liveTimeline.getEvents().length;
                    
                    try {
                        // Load initial batch of file events - try multiple times to ensure we get events
                        // For filtered timelineSets, we need to paginate to load events from the server
                        let paginationAttempts = 0;
                        const maxPaginationAttempts = 5;
                        let lastEventCount = eventsBeforePagination;
                        
                        while (paginationAttempts < maxPaginationAttempts) {
                            const tokenBefore = liveTimeline.getPaginationToken(Direction.Backward);
                            
                            // Try to paginate even if there's no token initially
                            // The filtered timelineSet might need initial pagination to get the token
                            try {
                                await client.paginateEventTimeline(liveTimeline, {
                                    backwards: true,
                                    limit: 50,
                                });
                            } catch (paginationError) {
                                // If pagination fails (e.g., no token), that's okay - we'll stop
                                logger.warn(`FilePanel: Pagination attempt ${paginationAttempts + 1} failed:`, paginationError);
                                break;
                            }
                            
                            const eventsAfterPagination = liveTimeline.getEvents().length;
                            const eventsLoaded = eventsAfterPagination - lastEventCount;
                            
                            logger.log(
                                `FilePanel: Pagination attempt ${paginationAttempts + 1}: ` +
                                `Loaded ${eventsLoaded} events (total: ${eventsAfterPagination})`
                            );
                            
                            // If we didn't load any events, stop paginating
                            if (eventsLoaded === 0) {
                                break;
                            }
                            
                            lastEventCount = eventsAfterPagination;
                            
                            // Check if there's a token for more pagination
                            const tokenAfter = liveTimeline.getPaginationToken(Direction.Backward);
                            if (!tokenAfter || tokenAfter === tokenBefore) {
                                // No more events to paginate
                                break;
                            }
                            
                            paginationAttempts++;
                        }
                        
                        const finalEventCount = liveTimeline.getEvents().length;
                        logger.log(`FilePanel: Final event count after pagination: ${finalEventCount} (backfilled: ${backfilledCount})`);
                    } catch (error) {
                        logger.error("Failed to paginate file timeline on initial load", error);
                    }
                }

                // Set state AFTER pagination completes so TimelinePanel loads with events
                this.setState({ timelineSet: timelineSet }, () => {
                    // Trigger a refresh of the TimelinePanel to ensure it displays the loaded events
                    // Use setTimeout to ensure the TimelinePanel has mounted
                    setTimeout(() => {
                        if (this.timelinePanel.current) {
                            this.timelinePanel.current.refreshTimeline();
                        }
                    }, 100);
                });
            } catch (error) {
                logger.error("Failed to get or create file panel filter", error);
            }
        } else {
            logger.error("Failed to add filtered timelineSet for FilePanel as no room!");
        }
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
                        header={_t("right_panel|files_button")}
                    >
                        <Measured sensor={this.card} onMeasurement={this.onMeasurement} />
                        <SearchWarning isRoomEncrypted={isRoomEncrypted} kind={WarningKind.Files} />
                        <TimelinePanel
                            ref={this.timelinePanel}
                            key={`file-panel-${this.props.roomId}`}
                            manageReadReceipts={false}
                            manageReadMarkers={false}
                            timelineSet={this.state.timelineSet}
                            showUrlPreview={false}
                            onPaginationRequest={this.onPaginationRequest}
                            resizeNotifier={this.props.resizeNotifier}
                            empty={emptyState}
                            layout={Layout.Group}
                        />
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
