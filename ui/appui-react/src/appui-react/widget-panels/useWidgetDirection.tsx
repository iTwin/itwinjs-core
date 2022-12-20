/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import { getTabLocation, isHorizontalPanelSide, NineZoneContext, TabIdContext } from "@itwin/appui-layout-react";
import { useFrameworkVersion } from "../hooks/useFrameworkVersion";

/** Returns widget direction.
 * I.e. "horizontal" when widget is in bottom/top stage panel.
 * @alpha
 */
export function useWidgetDirection(): "horizontal" | "vertical" {
  const version = useFrameworkVersion(); // eslint-disable-line deprecation/deprecation
  const tabId = React.useContext(TabIdContext);
  const nineZone = React.useContext(NineZoneContext);
  // istanbul ignore else
  if (version === "2") {
    const tabLocation = getTabLocation(nineZone, tabId);
    if (tabLocation && ("side" in tabLocation) && isHorizontalPanelSide(tabLocation.side)) {
      return "horizontal";
    }
  }
  return "vertical";
}
