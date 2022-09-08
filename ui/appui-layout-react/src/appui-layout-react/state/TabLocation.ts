/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import { PanelSide } from "../widget-panels/Panel";
import { TabState } from "./TabState";
import { NineZoneState } from "./NineZoneState";
import { FloatingWidgetState, PopoutWidgetState, WidgetState } from "./WidgetState";
import { getWidgetLocation, isFloatingWidgetLocation, isPopoutWidgetLocation } from "./WidgetLocation";

/** @internal */
export interface PanelTabLocation {
  widgetId: WidgetState["id"];
  side: PanelSide;
}

/** @internal */
export interface FloatingTabLocation {
  widgetId: WidgetState["id"];
  floatingWidgetId: FloatingWidgetState["id"];
}

/** @internal */
export interface PopoutTabLocation {
  widgetId: WidgetState["id"];
  popoutWidgetId: PopoutWidgetState["id"];
}

/** @internal */
export type TabLocation = PanelTabLocation | FloatingTabLocation | PopoutTabLocation;

/** @internal */
export function isFloatingTabLocation(location: TabLocation): location is FloatingTabLocation {
  return "floatingWidgetId" in location;
}

/** @internal */
export function isPopoutTabLocation(location: TabLocation): location is PopoutTabLocation {
  return "popoutWidgetId" in location;
}

/** @internal */
export function isPanelTabLocation(location: TabLocation): location is PanelTabLocation {
  return "side" in location;
}

/** Returns a tab location or `undefined` if tab is not in a widget.
 * @internal
 */
export function getTabLocation(state: NineZoneState, id: TabState["id"]): TabLocation | undefined {
  let widgetId;
  for (const [, widget] of Object.entries(state.widgets)) {
    const index = widget.tabs.indexOf(id);
    if (index >= 0) {
      widgetId = widget.id;
      break;
    }
  }
  if (!widgetId)
    return undefined;
  const location = getWidgetLocation(state, widgetId);
  if (!location)
    return undefined;
  if (isFloatingWidgetLocation(location))
    return {
      floatingWidgetId: widgetId,
      widgetId,
    };
  if (isPopoutWidgetLocation(location))
    return {
      popoutWidgetId: widgetId,
      widgetId,
    };
  return {
    side: location.side,
    widgetId,
  };
}
