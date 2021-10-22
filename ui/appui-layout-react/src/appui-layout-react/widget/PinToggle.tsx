/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./PinToggle.scss";
import classnames from "classnames";
import * as React from "react";
import { NineZoneDispatchContext, useLabel } from "../base/NineZone";
import { PanelSide, PanelStateContext } from "../widget-panels/Panel";
import { assert } from "@itwin/core-bentley";

/** @internal */
export const PinToggle = React.memo(function PinToggle() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const panelState = React.useContext(PanelStateContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  assert(!!panelState);
  const pinPanelTitle = useLabel("pinPanelTitle");
  const unpinPanelTitle = useLabel("unpinPanelTitle");
  const iconClassName = classnames(
    "icon",
    getPinToggleIcon(panelState.pinned, panelState.side),
  );
  return (
    <button
      className="nz-widget-pinToggle"
      onClick={() => {
        dispatch({
          side: panelState.side,
          type: "PANEL_TOGGLE_PINNED",
        });
      }}
      title={panelState.pinned ? unpinPanelTitle : pinPanelTitle}
    >
      <i className={iconClassName} />
    </button >
  );
});

function getPinToggleIcon(pinned: boolean, side: PanelSide) {
  if (pinned) {
    if (side === "top")
      return "icon-chevron-up";
    else if (side === "bottom")
      return "icon-chevron-down";
    return `icon-chevron-${side}`;
  }
  return "icon-pin";
}
