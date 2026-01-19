# How to Fix Rooms Already Marked as DMs

If you accepted invites **before** applying the fix, those rooms may already be incorrectly stored in your `m.direct` account data. Here's how to fix them:

## Option 1: Remove from m.direct via Developer Console

1. Open your browser's Developer Console (F12 or Cmd+Option+I on Mac)
2. Paste this code to see all your DM rooms:

```javascript
// Get the Matrix client
const cli = window.mxMatrixClientPeg.get();

// Get m.direct account data
const directMap = cli.getAccountData("m.direct")?.getContent() || {};

// Display all DM rooms
console.table(directMap);
```

3. Find the room ID of the incorrectly marked room (you can get it from room settings or URL)

4. Remove it from m.direct with this code (replace ROOM_ID and USER_ID):

```javascript
const cli = window.mxMatrixClientPeg.get();
const roomIdToRemove = "!YOUR_ROOM_ID:server.com";  // Replace with actual room ID

// Get current m.direct
const directMap = cli.getAccountData("m.direct")?.getContent() || {};

// Remove the room from all users
for (const [userId, roomIds] of Object.entries(directMap)) {
    if (Array.isArray(roomIds)) {
        const index = roomIds.indexOf(roomIdToRemove);
        if (index > -1) {
            roomIds.splice(index, 1);
            console.log(`Removed room ${roomIdToRemove} from user ${userId}`);
            
            // If user has no more DM rooms, remove the user entry
            if (roomIds.length === 0) {
                delete directMap[userId];
            }
        }
    }
}

// Save back to account data
cli.setAccountData("m.direct", directMap).then(() => {
    console.log("Successfully updated m.direct account data");
    // Refresh the page to see changes
    window.location.reload();
}).catch((err) => {
    console.error("Failed to update m.direct", err);
});
```

## Option 2: Check if Room Has is_direct Flag

To check if the invite actually had the `is_direct` flag:

```javascript
const cli = window.mxMatrixClientPeg.get();
const roomId = "!YOUR_ROOM_ID:server.com";  // Replace with actual room ID
const room = cli.getRoom(roomId);

if (room) {
    const myUserId = cli.getSafeUserId();
    const myMember = room.getMember(myUserId);
    const memberEvent = myMember?.events?.member;
    const memberContent = memberEvent?.getContent();
    
    console.log("Room ID:", roomId);
    console.log("Room Name:", room.name);
    console.log("Member count:", room.getJoinedMemberCount());
    console.log("is_direct flag:", memberContent?.is_direct);
    console.log("Was this a DM invite:", memberContent?.is_direct === true);
}
```

## Option 3: Fresh Start (Nuclear Option)

If you want to completely reset your DM tracking:

⚠️ **WARNING**: This will remove ALL room DM markings. Only do this if you're okay re-marking your actual DMs.

```javascript
const cli = window.mxMatrixClientPeg.get();

// Clear all m.direct data
cli.setAccountData("m.direct", {}).then(() => {
    console.log("Cleared all m.direct data");
    window.location.reload();
});
```

## After Fixing

1. Refresh the page
2. The room should now appear in "Rooms" section (not "People")
3. The right panel should show the group chat menu (with Invite, People, Settings, etc.)

## Prevention

With the fix applied, new invitations will:
- ✅ Only be marked as DMs if they have `is_direct: true` flag
- ✅ Not be auto-marked based on member count
- ✅ Properly stay as group chats even with 2 members
