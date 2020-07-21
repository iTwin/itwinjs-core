/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./SendBack.scss";
import * as React from "react";
import { assert } from "../base/assert";
import { NineZoneDispatchContext, useLabel } from "../base/NineZone";
import { toolSettingsTabId } from "../base/NineZoneState";
import { PanelSideContext } from "../widget-panels/Panel";
import { FloatingWidgetIdContext } from "./FloatingWidget";
import { ActiveTabIdContext, WidgetIdContext } from "./Widget";

/** @internal */
export const SendBack = React.memo(function SendBack() { // tslint:disable-line: variable-name no-shadowed-variable
  const activeTabId = React.useContext(ActiveTabIdContext);
  const widgetId = React.useContext(WidgetIdContext);
  const floatingWidgetId = React.useContext(FloatingWidgetIdContext);
  const side = React.useContext(PanelSideContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  const dockToolSettingsTitle = useLabel("dockToolSettingsTitle");
  assert(widgetId);
  if (activeTabId !== toolSettingsTabId)
    return null;
  return (
    <button
      className="nz-widget-sendBack"
      onClick={() => {
        dispatch({
          type: "WIDGET_SEND_BACK",
          floatingWidgetId,
          side,
          widgetId,
        });
      }}
      title={dockToolSettingsTitle}
    >
      <i />
    </button >
  );
});
