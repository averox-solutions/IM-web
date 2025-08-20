/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */


import { target } from 'modernizr';
import FrameIcon from '../../../../../res/img/element-icons/Frame (1).svg';
export const ThreadsActivityCentreButton = () => {

  return (
<>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',  // Center horizontally
          alignItems: 'center',      // Center vertically
          width: '100%',           // Take up the full viewport height
          marginTop: '0',            // Remove any top margin
        }}
      >
      <button
        style={{
          border: 'none',
          background: 'none',
          display: 'none',
          cursor: 'pointer',
        }}
        onClick={() => window.open("https://beep.gov.pk", "_blank")} // Opens in new tab
        aria-label="Navigate to video call"
      >
        <img
          src={FrameIcon}
          alt="Video Call Icon"
          style={{
            height: '24px',
            width: '24px',
            marginRight: '5px',
          }}
        />
      </button>

      </div>
    </>

  );
};
