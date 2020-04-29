/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import { NineZoneDispatchContext } from "../base/NineZone";
import { ActiveTabIdContext, WidgetIdContext } from "./Widget";
import { WIDGET_SEND_BACK, toolSettingsTabId } from "../base/NineZoneState";
import { assert } from "../base/assert";
import { FloatingWidgetIdContext } from "./FloatingWidget";
import { PanelSideContext } from "../widget-panels/Panel";
import "./SendBack.scss";

/** @internal */
export const SendBack = React.memo(function SendBack() { // tslint:disable-line: variable-name no-shadowed-variable
  const activeTabId = React.useContext(ActiveTabIdContext);
  const widgetId = React.useContext(WidgetIdContext);
  const floatingWidgetId = React.useContext(FloatingWidgetIdContext);
  const side = React.useContext(PanelSideContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  assert(widgetId);
  if (activeTabId !== toolSettingsTabId)
    return null;
  return (
    <button
      className="nz-widget-sendBack"
      onClick={() => {
        dispatch({
          type: WIDGET_SEND_BACK,
          floatingWidgetId,
          side,
          widgetId,
        });
      }}
    >
      <i />
    </button >
  );
});
