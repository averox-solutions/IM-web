/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2018 , 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import RoomSublist from "../views/rooms/RoomSublist";
import { DefaultTagID } from "../../stores/room-list/models";

const CallLogSublist = () => {
  return (
    <RoomSublist
      tagId={DefaultTagID.CallLog}
      label={_t("Call Log")}
      // Customize further to display call events (e.g., filter by m.call.* events)
    />
  );
};

export default CallLogSublist;