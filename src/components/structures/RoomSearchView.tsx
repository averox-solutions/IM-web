/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
    type ISearchResults,
    type IThreadBundledRelationship,
    type MatrixEvent,
    THREAD_RELATION_TYPE,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import ScrollPanel from "./ScrollPanel";
import Spinner from "../views/elements/Spinner";
import { _t } from "../../languageHandler";
import { haveRendererForEvent } from "../../events/EventTileFactory";
import SearchResultTile from "../views/rooms/SearchResultTile";
import { searchPagination, SearchScope } from "../../Searching";
import Modal from "../../Modal";
import ErrorDialog from "../views/dialogs/ErrorDialog";
import type ResizeNotifier from "../../utils/ResizeNotifier";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import { useScopedRoomContext } from "../../contexts/ScopedRoomContext";

const DEBUG = false;
let debuglog = function (msg: string): void {};

/* istanbul ignore next */
if (DEBUG) {
    // using bind means that we get to keep useful line numbers in the console
    debuglog = logger.log.bind(console);
}

interface Props {
    term: string;
    scope: SearchScope;
    inProgress: boolean;
    promise: Promise<ISearchResults>;
    abortController?: AbortController;
    resizeNotifier: ResizeNotifier;
    className: string;
    onUpdate(inProgress: boolean, results: ISearchResults | null): void;
}

// XXX: todo: merge overlapping results somehow?
// XXX: why doesn't searching on name work?
export const RoomSearchView = forwardRef<ScrollPanel, Props>(
    ({ term, scope, promise, abortController, resizeNotifier, className, onUpdate, inProgress }: Props, ref) => {
        const client = useContext(MatrixClientContext);
        const roomContext = useScopedRoomContext("showHiddenEvents");
        const [highlights, setHighlights] = useState<string[] | null>(null);
        const [results, setResults] = useState<ISearchResults | null>(null);
        const aborted = useRef(false);
        // A map from room ID to permalink creator
        const permalinkCreators = useMemo(() => new Map<string, RoomPermalinkCreator>(), []);
        const innerRef = useRef<ScrollPanel | null>();

        useEffect(() => {
            return () => {
                permalinkCreators.forEach((pc) => pc.stop());
                permalinkCreators.clear();
            };
        }, [permalinkCreators]);

        const handleSearchResult = useCallback(
            (searchPromise: Promise<ISearchResults>): Promise<boolean> => {
                console.log("🔍 [ROOM_SEARCH_VIEW] handleSearchResult called");
                console.log("🔍 [ROOM_SEARCH_VIEW] Setting inProgress to true");
                onUpdate(true, null);

                return searchPromise
                    .then(
                        async (results): Promise<boolean> => {
                            console.log("🔍 [ROOM_SEARCH_VIEW] Search promise resolved");
                            console.log("🔍 [ROOM_SEARCH_VIEW] Results:", results);
                            console.log("🔍 [ROOM_SEARCH_VIEW] Results count:", results?.count);
                            console.log("🔍 [ROOM_SEARCH_VIEW] Results array length:", results?.results?.length);
                            console.log("🔍 [ROOM_SEARCH_VIEW] Results array:", results?.results);
                            console.log("🔍 [ROOM_SEARCH_VIEW] Highlights:", results?.highlights);
                            
                            debuglog("search complete");
                            if (aborted.current) {
                                console.log("🔍 [ROOM_SEARCH_VIEW] Search was aborted, discarding results");
                                logger.error("Discarding stale search results");
                                return false;
                            }

                            // Validate results
                            if (!results) {
                                console.error("🔍 [ROOM_SEARCH_VIEW] ERROR: Search returned no results object");
                                throw new Error("Search returned no results");
                            }

                            // postgres on synapse returns us precise details of the strings
                            // which actually got matched for highlighting.
                            //
                            // In either case, we want to highlight the literal search term
                            // whether it was used by the search engine or not.

                            let highlights = results.highlights || [];
                            if (!highlights.includes(term)) {
                                highlights = highlights.concat(term);
                            }

                            // For overlapping highlights,
                            // favour longer (more specific) terms first
                            highlights = highlights.sort(function (a, b) {
                                return b.length - a.length;
                            });

                            for (const result of results.results || []) {
                                for (const event of result.context.getTimeline()) {
                                    const bundledRelationship =
                                        event.getServerAggregatedRelation<IThreadBundledRelationship>(
                                            THREAD_RELATION_TYPE.name,
                                        );
                                    if (!bundledRelationship || event.getThread()) continue;
                                    const room = client.getRoom(event.getRoomId());
                                    const thread = room?.findThreadForEvent(event);
                                    if (thread) {
                                        event.setThread(thread);
                                    } else {
                                        room?.createThread(event.getId()!, event, [], true);
                                    }
                                }
                            }

                            console.log("🔍 [ROOM_SEARCH_VIEW] Setting highlights:", highlights);
                            console.log("🔍 [ROOM_SEARCH_VIEW] Setting results state");
                            setHighlights(highlights);
                            setResults({ ...results }); // copy to force a refresh
                            console.log("🔍 [ROOM_SEARCH_VIEW] Calling onUpdate(false, results)");
                            onUpdate(false, results);
                            console.log("🔍 [ROOM_SEARCH_VIEW] Search result handling complete");
                            return false;
                        },
                        (error) => {
                            // Re-throw to be caught by outer catch
                            throw error;
                        },
                    )
                    .catch((error) => {
                        console.error("🔍 [ROOM_SEARCH_VIEW] ERROR in search promise:", error);
                        console.error("🔍 [ROOM_SEARCH_VIEW] Error name:", error?.name);
                        console.error("🔍 [ROOM_SEARCH_VIEW] Error message:", error?.message);
                        console.error("🔍 [ROOM_SEARCH_VIEW] Error stack:", error?.stack);
                        
                        if (aborted.current) {
                            console.log("🔍 [ROOM_SEARCH_VIEW] Search was aborted, discarding error");
                            // Component is unmounting, discard results
                            return false;
                        }
                        
                        // Check if this is an AbortError (expected during component cleanup/unmount)
                        const isAbortError =
                            error?.name === "AbortError" ||
                            error?.message?.includes("aborted") ||
                            error?.message?.includes("signal is aborted");
                        
                        console.log("🔍 [ROOM_SEARCH_VIEW] Is AbortError:", isAbortError);
                        
                        if (isAbortError) {
                            console.log("🔍 [ROOM_SEARCH_VIEW] AbortError detected, updating UI state");
                            // AbortError is expected when search is cancelled (e.g., during unmount or new search)
                            // Don't show error dialog, but still update UI state
                            onUpdate(false, null);
                            return false;
                        }
                        
                        // Log and show error for actual search failures
                        const errorMessage = error?.message || error?.toString() || "Unknown error occurred";
                        console.error("🔍 [ROOM_SEARCH_VIEW] Search failed with error:", errorMessage);
                        logger.error("Search failed", error);
                        
                        // Show error dialog with detailed message
                        Modal.createDialog(ErrorDialog, {
                            title: _t("error_dialog|search_failed|title"),
                            description: errorMessage || _t("error_dialog|search_failed|server_unavailable"),
                        });
                        
                        // Update UI to show search failed state
                        console.log("🔍 [ROOM_SEARCH_VIEW] Updating UI to show search failed state");
                        onUpdate(false, null);
                        setResults(null);
                        setHighlights(null);
                        return false;
                    });
            },
            [client, term, onUpdate],
        );

        // Mount & unmount effect - re-run when promise changes (new search initiated)
        // Store previous abortController to cancel it when a new search starts
        const prevAbortControllerRef = useRef<AbortController | undefined>();
        
        useEffect(() => {
            console.log("🔍 [ROOM_SEARCH_VIEW] useEffect triggered - new search starting");
            console.log("🔍 [ROOM_SEARCH_VIEW] Search term:", term);
            console.log("🔍 [ROOM_SEARCH_VIEW] Promise:", promise);
            console.log("🔍 [ROOM_SEARCH_VIEW] AbortController:", abortController);
            
            // Abort previous search if a new one is starting
            const prevController = prevAbortControllerRef.current;
            if (prevController && prevController !== abortController) {
                console.log("🔍 [ROOM_SEARCH_VIEW] Aborting previous search");
                prevController.abort();
            }
            prevAbortControllerRef.current = abortController;
            
            aborted.current = false;
            // Reset results when starting a new search
            console.log("🔍 [ROOM_SEARCH_VIEW] Resetting results and highlights");
            setResults(null);
            setHighlights(null);
            console.log("🔍 [ROOM_SEARCH_VIEW] Calling handleSearchResult");
            handleSearchResult(promise);
            
            return () => {
                console.log("🔍 [ROOM_SEARCH_VIEW] useEffect cleanup - aborting search");
                aborted.current = true;
                // Only abort if this is still the current search (not replaced by a new one)
                if (abortController && abortController === prevAbortControllerRef.current) {
                    abortController.abort();
                }
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [promise, abortController]); // Removed handleSearchResult from deps to prevent premature aborts when term changes

        // show searching spinner
        if (results === null) {
            console.log("🔍 [ROOM_SEARCH_VIEW] Rendering: results is null, showing spinner");
            return (
                <div
                    className="mx_RoomView_messagePanel mx_RoomView_messagePanelSearchSpinner"
                    data-testid="messagePanelSearchSpinner"
                />
            );
        }
        
        console.log("🔍 [ROOM_SEARCH_VIEW] Rendering: results available");
        console.log("🔍 [ROOM_SEARCH_VIEW] Results count:", results?.results?.length);
        console.log("🔍 [ROOM_SEARCH_VIEW] In progress:", inProgress);

        const onSearchResultsFillRequest = async (backwards: boolean): Promise<boolean> => {
            if (!backwards) {
                return false;
            }

            if (!results.next_batch) {
                debuglog("no more search results");
                return false;
            }

            debuglog("requesting more search results");
            const searchPromise = searchPagination(client, results);
            return handleSearchResult(searchPromise);
        };

        const ret: JSX.Element[] = [];

        if (inProgress) {
            ret.push(
                <li key="search-spinner">
                    <Spinner />
                </li>,
            );
        }

        if (!results.next_batch) {
            if (!results?.results?.length) {
                ret.push(
                    <li key="search-top-marker">
                        <h2 className="mx_RoomView_topMarker">{_t("common|no_results")}</h2>
                    </li>,
                );
            } else {
                ret.push(
                    <li key="search-top-marker">
                        <h2 className="mx_RoomView_topMarker">{_t("no_more_results")}</h2>
                    </li>,
                );
            }
        }

        // once dynamic content in the search results load, make the scrollPanel check
        // the scroll offsets.
        const onHeightChanged = (): void => {
            innerRef.current?.checkScroll();
        };

        const onRef = (e: ScrollPanel | null): void => {
            if (typeof ref === "function") {
                ref(e);
            } else if (!!ref) {
                ref.current = e;
            }
            innerRef.current = e;
        };

        let lastRoomId: string | undefined;
        let mergedTimeline: MatrixEvent[] = [];
        let ourEventsIndexes: number[] = [];

        for (let i = (results?.results?.length || 0) - 1; i >= 0; i--) {
            const result = results.results[i];

            const mxEv = result.context.getEvent();
            const roomId = mxEv.getRoomId()!;
            const room = client.getRoom(roomId);
            if (!room) {
                // if we do not have the room in js-sdk stores then hide it as we cannot easily show it
                // As per the spec, an all rooms search can create this condition,
                // it happens with Seshat but not Synapse.
                // It will make the result count not match the displayed count.
                logger.log("Hiding search result from an unknown room", roomId);
                continue;
            }

            if (!haveRendererForEvent(mxEv, client, roomContext.showHiddenEvents)) {
                // XXX: can this ever happen? It will make the result count
                // not match the displayed count.
                continue;
            }

            if (scope === SearchScope.All) {
                if (roomId !== lastRoomId) {
                    ret.push(
                        <li key={mxEv.getId() + "-room"}>
                            <h2>
                                {_t("common|room")}: {room.name}
                            </h2>
                        </li>,
                    );
                    lastRoomId = roomId;
                }
            }

            const resultLink = "#/room/" + roomId + "/" + mxEv.getId();

            // merging two successive search result if the query is present in both of them
            const currentTimeline = result.context.getTimeline();
            const nextTimeline = i > 0 ? results.results[i - 1].context.getTimeline() : [];

            if (i > 0 && currentTimeline[currentTimeline.length - 1].getId() == nextTimeline[0].getId()) {
                // if this is the first searchResult we merge then add all values of the current searchResult
                if (mergedTimeline.length == 0) {
                    for (let j = mergedTimeline.length == 0 ? 0 : 1; j < result.context.getTimeline().length; j++) {
                        mergedTimeline.push(currentTimeline[j]);
                    }
                    ourEventsIndexes.push(result.context.getOurEventIndex());
                }

                // merge the events of the next searchResult
                for (let j = 1; j < nextTimeline.length; j++) {
                    mergedTimeline.push(nextTimeline[j]);
                }

                // add the index of the matching event of the next searchResult
                ourEventsIndexes.push(
                    ourEventsIndexes[ourEventsIndexes.length - 1] +
                        results.results[i - 1].context.getOurEventIndex() +
                        1,
                );

                continue;
            }

            if (mergedTimeline.length == 0) {
                mergedTimeline = result.context.getTimeline();
                ourEventsIndexes = [];
                ourEventsIndexes.push(result.context.getOurEventIndex());
            }

            let permalinkCreator = permalinkCreators.get(roomId);
            if (!permalinkCreator) {
                permalinkCreator = new RoomPermalinkCreator(room);
                permalinkCreator.start();
                permalinkCreators.set(roomId, permalinkCreator);
            }

            ret.push(
                <SearchResultTile
                    key={mxEv.getId()}
                    timeline={mergedTimeline}
                    ourEventsIndexes={ourEventsIndexes}
                    searchHighlights={highlights ?? []}
                    resultLink={resultLink}
                    permalinkCreator={permalinkCreator}
                    onHeightChanged={onHeightChanged}
                />,
            );

            ourEventsIndexes = [];
            mergedTimeline = [];
        }

        return (
            <ScrollPanel
                ref={onRef}
                className={"mx_RoomView_searchResultsPanel " + className}
                onFillRequest={onSearchResultsFillRequest}
                resizeNotifier={resizeNotifier}
            >
                <li className="mx_RoomView_scrollheader" />
                {ret}
            </ScrollPanel>
        );
    },
);
