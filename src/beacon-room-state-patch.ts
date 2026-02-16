/*
 * Patch matrix-js-sdk RoomState.processBeaconEvents to accept m.room.message
 * events with msgtype m.location as beacon location updates.
 *
 * OwnBeaconStore sends location as m.room.message (for FluffyChat compatibility)
 * instead of m.beacon. Without this patch, the Beacon model never receives
 * latestLocationState, causing "Loading live location…" to persist.
 */

import { RoomState } from "matrix-js-sdk/src/models/room-state";
import { EventType, MsgType, RelationType } from "matrix-js-sdk/src/matrix";
import { M_BEACON } from "matrix-js-sdk/src/@types/beacon";
import type { MatrixEvent } from "matrix-js-sdk/src/models/event";

const originalProcessBeaconEvents = RoomState.prototype.processBeaconEvents;

if (typeof originalProcessBeaconEvents === "function") {
    RoomState.prototype.processBeaconEvents = async function processBeaconEvents(
        events: Parameters<typeof originalProcessBeaconEvents>[0],
        matrixClient: Parameters<typeof originalProcessBeaconEvents>[1],
    ): Promise<void> {
        if (!events?.length || !this.beacons.size) {
            return;
        }

        const beaconByEventIdDict = [...this.beacons.values()].reduce<Record<string, any>>(
            (dict, beacon) => {
                dict[beacon.beaconInfoId] = beacon;
                return dict;
            },
            {},
        );

        const room = matrixClient.getRoom?.((this as RoomState).roomId);

        const isMBeaconOrLocationMessage = (event: MatrixEvent): boolean =>
            M_BEACON.matches(event.getType()) ||
            (event.getType() === EventType.RoomMessage &&
                event.getContent()?.msgtype === MsgType.Location);

        const resolveBeaconInfoId = (eventId: string): string | null => {
            if (beaconByEventIdDict[eventId]) return eventId;
            const targetEvent = room?.findEventById?.(eventId) as MatrixEvent | undefined;
            if (!targetEvent) return null;
            const rel = targetEvent.getRelation?.();
            if (!rel?.event_id) return null;
            if (rel.rel_type === RelationType.Reference) return rel.event_id;
            if (rel.rel_type === RelationType.Replace) return resolveBeaconInfoId(rel.event_id);
            return null;
        };

        const processBeaconRelation = (beaconInfoEventId: string, event: MatrixEvent): void => {
            if (!isMBeaconOrLocationMessage(event)) return;
            const beacon = beaconByEventIdDict[beaconInfoEventId];
            if (beacon) beacon.addLocations([event]);
        };

        for (const event of events) {
            const relation = event.getRelation?.();
            const relatedToEventId = relation?.event_id;
            if (!relatedToEventId) continue;

            const beaconInfoEventId = relation?.rel_type === RelationType.Reference
                ? relatedToEventId
                : relation?.rel_type === RelationType.Replace
                    ? resolveBeaconInfoId(relatedToEventId)
                    : relatedToEventId;

            if (!beaconInfoEventId || !beaconByEventIdDict[beaconInfoEventId]) continue;
            if (!isMBeaconOrLocationMessage(event) && !event.isEncrypted?.()) continue;

            try {
                await matrixClient.decryptEventIfNeeded(event);
                processBeaconRelation(beaconInfoEventId, event);
            } catch {
                if (event.isDecryptionFailure?.()) {
                    const { MatrixEventEvent } = await import("matrix-js-sdk/src/models/event");
                    event.once(MatrixEventEvent.Decrypted, () => {
                        processBeaconRelation(beaconInfoEventId, event);
                    });
                }
            }
        }
    };
}
