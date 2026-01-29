# Live Location Compatibility Fix

## Problem
Live location messages sent from the web app (Element Web) were not being received/displayed properly on the FluffyChat mobile app.

## Root Cause
The issue was a **Matrix protocol version incompatibility**:

### Web App (Element Web)
- Uses the **modern Matrix spec format** via `ContentHelpers.makeLocationContent()`
- Creates location events with the `M_LOCATION` structure:
  ```json
  {
    "msgtype": "m.location",
    "body": "Location description",
    "org.matrix.msc3488.location": {
      "uri": "geo:37.786971,-122.399677"
    }
  }
  ```

### FluffyChat Mobile App
- Expects the **legacy format** with a direct `geo_uri` field:
  ```json
  {
    "msgtype": "m.location",
    "body": "Location description",
    "geo_uri": "geo:37.786971,-122.399677"
  }
  ```

FluffyChat's code explicitly looks for `content['geo_uri']`:
```dart
final geoUriString = event.content.tryGet<String>('geo_uri');
```

## Solution
Added the legacy `geo_uri` field to location messages for **backward compatibility** while maintaining the modern format. This ensures compatibility with both old and new Matrix clients.

### Files Modified

1. **`/src/components/views/location/shareLocation.ts`** (line ~243)
   - Added `content["geo_uri"] = uri;` when sending location messages
   - Affects: Pin locations, self-location shares, and live location updates

2. **`/src/components/views/dialogs/ForwardDialog.tsx`** (line ~214)
   - Added `geo_uri: geoUri` when forwarding location messages
   - Ensures forwarded locations also work with FluffyChat


3. **`/src/stores/OwnBeaconStore.ts`** (line ~600)
   - Added `content["geo_uri"] = geoUri;` to live location periodic updates
   - Ensures that the stream of live location events is received by FluffyChat

## Technical Details

The fix adds both formats to the event content:
```typescript
const content = ContentHelpers.makeLocationContent(
    undefined,
    uri,
    timestamp,
    undefined,
    assetType,
) as RoomMessageEventContent;

// Add legacy geo_uri field for backward compatibility
content["geo_uri"] = uri;
```

This creates a message with **both** the modern `M_LOCATION` structure AND the legacy `geo_uri` field:
```json
{
  "msgtype": "m.location",
  "body": "Shared Location (37.786971°N, 122.399677°W)\ngeo:37.786971,-122.399677",
  "geo_uri": "geo:37.786971,-122.399677",
  "org.matrix.msc3488.location": {
    "uri": "geo:37.786971,-122.399677"
  }
}
```

Similarly for live location updates (`m.beacon` / `m.location`):
```typescript
const content = ContentHelpers.makeBeaconContent(geoUri, ...);
content["geo_uri"] = geoUri;
```

## Testing
To verify the fix:
1. Send a location from the web app
2. Check that it appears correctly in FluffyChat mobile app
3. Send a live location from the web app
4. Verify that live location updates are received in FluffyChat
5. Forward a location message and verify it works

## References
- [Matrix Spec Issue #3516](https://github.com/matrix-org/matrix-doc/issues/3516) - Discussion about legacy `geo_uri` support
- FluffyChat expects `geo_uri` as shown in the provided code
- Element Web uses `M_LOCATION` format from matrix-js-sdk

## Notes
- This is a **non-breaking change** - it adds data without removing existing functionality
- Modern clients will use `M_LOCATION`, legacy clients will use `geo_uri`
- The fix applies to all location sharing scenarios: pin drops, self-location, live location, and forwarded locations
