/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./Dock.scss";
import * as React from "react";
import { NineZoneDispatchContext, useLabel } from "../base/NineZone";

/** @internal */
export const Dock = React.memo(function Dock() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const dispatch = React.useContext(NineZoneDispatchContext);
  const title = useLabel("dockToolSettingsTitle");
  return (
    <button
      className="nz-widget-dock"
      onClick={() => {
        dispatch({
          type: "TOOL_SETTINGS_DOCK",
        });
      }}
      title={title}
    >
      <i />
    </button >
  );
});
