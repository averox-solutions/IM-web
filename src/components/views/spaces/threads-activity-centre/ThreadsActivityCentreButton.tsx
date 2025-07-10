/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import React, { useState, useEffect } from 'react';

import FrameIcon from '../../../../../res/img/element-icons/Frame (1).svg';
export const ThreadsActivityCentreButton = () => {

  return (
<>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',  // Center horizontally
          alignItems: 'center',      // Center vertically
          height: '100vh',           // Take up the full viewport height
          marginTop: '0',            // Remove any top margin
        }}
      >
        <button
          style={{
            border: 'none',
            background: 'none',
            display: 'flex',
            cursor: 'pointer',
          }}
          onClick={() => window.location.href = "https://vc.beep.gov.pk"} // Navigate to vc.beep.gov.pk
          aria-label="Navigate to video call"
        >
          <img
            src={FrameIcon}
            alt="Video Call Icon"
            style={{
              height: '24px', // Set the size of the icon
              width: '24px',
              marginRight: '5px',
            }}
          />
        </button>
      </div>
    </>

  );
};
