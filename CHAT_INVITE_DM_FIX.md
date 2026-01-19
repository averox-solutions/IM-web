# Fix: Chat Invite Being Incorrectly Marked as 1-1 Chat

## Problem Description
When accepting an invite to a group chat that has 2 members (inviter + invitee), the chat was being automatically marked as a direct message (1-1 chat) instead of remaining a group chat.

## Root Cause
There were **FOUR** problematic locations in the codebase that assumed **any room with exactly 2 members is a direct message**:

### Location 1: RoomViewStore.tsx (Pre-join Detection)
**File**: `/src/stores/RoomViewStore.tsx` (Lines 537-551, now removed)

This logic checked member count BEFORE joining and incorrectly marked 2-member rooms as DMs.

### Location 2: RoomViewStore.tsx (Post-join Detection)  
**File**: `/src/stores/RoomViewStore.tsx` (Lines 568-589, now removed)

This logic checked member count AFTER joining and incorrectly marked 2-member rooms as DMs.

### Location 3: Algorithm.ts (setKnownRooms Function)
**File**: `/src/stores/room-list/algorithms/Algorithm.ts` (Lines 1577-1593, now removed)

This logic in the room list algorithm checked member count when organizing rooms and incorrectly marked 2-member rooms as DMs.

### Location 4: Algorithm.ts (getTagsOfJoinedRoom Function)
**File**: `/src/stores/room-list/algorithms/Algorithm.ts` (Lines 1650-1665, now removed)

This logic determined room tags based on member count and incorrectly marked 2-member rooms as DMs.

## Why This Was Wrong
The assumption that **"2 members = DM"** is fundamentally flawed because:

1. **Group chats can have 2 members** - A user may create a group chat intending to add more members later
2. **The creator's intent matters** - If they created a group chat, it should stay a group chat
3. **The `is_direct` flag is authoritative** - Matrix spec provides an explicit way to mark DMs via the `is_direct` flag in invite events
4. **The `m.direct` account data is the source of truth** - Rooms tracked in the `m.direct` account data event are the official DM rooms

## The Fix

### Files Modified:
1. `/src/stores/RoomViewStore.tsx`
2. `/src/stores/room-list/algorithms/Algorithm.ts`

### Changes Made:

**All four problematic code blocks were removed.** Now a room is **ONLY** marked as a DM if:

✅ **The invite has the `is_direct` flag set to `true`**, OR  
✅ **The room is tracked in the `m.direct` account data**

We **DO NOT** automatically assume that a room with 2 members is a DM.

### Code Examples:

**Before (WRONG):**
```typescript
// ❌ Problematic logic (removed)
const joinedCount = room.getJoinedMemberCount();
if (joinedCount === 2) {
    // Assume it's a DM
    isDMInvite = true;
    setDMRoom(cli, roomId, otherUserId);
}
```

**After (CORRECT):**
```typescript
// ✅ Only mark as DM if explicitly indicated
if (memberContent?.is_direct === true) {
    isDMInvite = true;
    dmTargetUserId = inviteEvent?.getSender();
}

// Check if previously marked as DM in m.direct
const directMap = cli.getAccountData("m.direct")?.getContent() || {};
for (const [userId, roomIds] of Object.entries(directMap)) {
    if (Array.isArray(roomIds) && roomIds.includes(roomId)) {
        wasPreviouslyDM = true;
        dmTargetUserId = userId;
        break;
    }
}

// Note: We do NOT check member count to determine DM status
```

## Testing Scenarios
After this fix:
- ✅ **Group chats with 2 members** will remain as group chats (shown in "Rooms" section)
- ✅ **Actual DMs** (with `is_direct` flag) will still be marked correctly (shown in "People" section)
- ✅ **Previously established DMs** will remain as DMs when re-invited
- ✅ **Existing rooms won't be auto-reclassified** based on member count

## Build Status
✅ Build completed successfully with no errors

## Impact
This is a **critical fix** that affects:
- Chat invitation handling
- Room categorization in the UI
- User experience (preventing confusion about chat types)
- Data integrity (not incorrectly modifying `m.direct` account data)

## How to Test
1. Have someone invite you to a **group chat** with 2 members total
2. Accept the invite
3. **Expected result**: The chat should appear in "Rooms" section, NOT "People"
4. Have someone invite you to an **actual DM** (created via "Start chat")
5. Accept the invite  
6. **Expected result**: The chat should appear in "People" section as a DM

## Files Changed Summary
- `src/stores/RoomViewStore.tsx` - Removed 2 blocks of auto-DM detection logic
- `src/stores/room-list/algorithms/Algorithm.ts` - Removed 2 blocks of auto-DM detection logic
- `CHAT_INVITE_DM_FIX.md` - Created comprehensive documentation

## Date Fixed
January 9, 2026
