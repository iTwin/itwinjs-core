/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import { PanelSide, panelSides } from "../widget-panels/Panel";
import { NineZoneState } from "./NineZoneState";
import { FloatingWidgetState, PopoutWidgetState, WidgetState } from "./WidgetState";

/** @internal */
export interface PanelWidgetLocation {
  side: PanelSide;
  index: number;
}

/** @internal */
export interface FloatingWidgetLocation {
  floatingWidgetId: FloatingWidgetState["id"];
}

/** @internal */
export interface PopoutWidgetLocation {
  popoutWidgetId: PopoutWidgetState["id"];
}

/** @internal */
export type WidgetLocation = PanelWidgetLocation | FloatingWidgetLocation | PopoutWidgetLocation;

/** @internal */
export function isFloatingWidgetLocation(location: WidgetLocation): location is FloatingWidgetLocation {
  return "floatingWidgetId" in location;
}

/** @internal */
export function isPopoutWidgetLocation(location: WidgetLocation): location is PopoutWidgetLocation {
  return "popoutWidgetId" in location;
}

/** @internal */
export function isPanelWidgetLocation(location: WidgetLocation): location is PanelWidgetLocation {
  return "side" in location;
}

/** Returns a widget location or `undefined` if widget is not found.
 * @internal
 */
export function getWidgetLocation(state: NineZoneState, id: WidgetState["id"]): WidgetLocation | undefined {
  if (id in state.floatingWidgets.byId) {
    return {
      floatingWidgetId: id,
    };
  }
  // istanbul ignore else
  if (state.popoutWidgets) {
    if (id in state.popoutWidgets.byId) {
      return {
        popoutWidgetId: id,
      };
    }
  }
  for (const side of panelSides) {
    const panel = state.panels[side];
    const index = panel.widgets.indexOf(id);
    if (index >= 0) {
      return {
        side,
        index,
      };
    }
  }
  return undefined;
}
