/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */
import * as React from "react";
import { NineZoneContext } from "../base/NineZone";
import { getWidgetLocation, isFloatingWidgetLocation, isPopoutWidgetLocation } from "../state/WidgetLocation";
import { useAllowedSideTarget } from "./useAllowedSideTarget";
import { WidgetState } from "../state/WidgetState";
import { assert } from "@itwin/core-bentley";
import { PanelSide } from "../widget-panels/Panel";

/** Checks the proposed docking target to see if it's allowed by the dragged widget or tab
 * @internal
 */
export function useAllowedWidgetTarget(widgetId: WidgetState["id"]) {
  const state = React.useContext(NineZoneContext);
  const widgetLocation = getWidgetLocation(state, widgetId);
  assert(!!widgetLocation);

  let allowedTarget: boolean = false;
  let side: PanelSide | undefined;

  if (!widgetLocation || isPopoutWidgetLocation(widgetLocation))  {
    allowedTarget = false;
    side = undefined;
  } else  if (isFloatingWidgetLocation(widgetLocation)) {
    allowedTarget = true;
    side = undefined;
  } else {
    side = widgetLocation.side;
  }

  allowedTarget = useAllowedSideTarget(side, allowedTarget);

  return allowedTarget;
}
