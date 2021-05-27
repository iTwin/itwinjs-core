/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

// cSpell:ignore popout

import "./PopoutToggle.scss";
import * as React from "react";
import { NineZoneDispatchContext, useLabel } from "../base/NineZone";
// import { PanelStateContext } from "../widget-panels/Panel";
// import { assert } from "@bentley/bentleyjs-core";
import popoutToggleSvg from "./window-popout.svg?sprite";
import { Icon } from "@bentley/ui-core";
import { IconSpecUtilities } from "@bentley/ui-abstract";
import { ActiveTabIdContext } from "./Widget";

/** @internal */
export const PopoutToggle = React.memo(function PopoutToggle() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const dispatch = React.useContext(NineZoneDispatchContext);
  const activeTabId = React.useContext(ActiveTabIdContext);
  const iconSpec = IconSpecUtilities.createSvgIconSpec(popoutToggleSvg);
  const popoutTitle = useLabel("popoutActiveTab");
  return (
    <button
      className="nz-widget-popoutToggle"
      onClick={() => {
        dispatch({
          id: activeTabId,
          type: "WIDGET_TAB_POPOUT",
        });
      }}
      title={popoutTitle}
    >
      <Icon iconSpec={iconSpec} />
    </button >
  );
});

