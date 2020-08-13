/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import { SendBack } from "./SendBack";
import { ActiveTabIdContext } from "./Widget";
import { toolSettingsTabId } from "../base/NineZoneState";
import { Dock } from "./Dock";
import { FloatingWidgetIdContext } from "./FloatingWidget";

/** @internal */
export const TabBarButtons = React.memo(function TabBarButtons() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const isToolSettings = useIsToolSettingsTab();
  const floatingWidgetId = React.useContext(FloatingWidgetIdContext);
  return (
    <>
      {floatingWidgetId && !isToolSettings && <SendBack />}
      {isToolSettings && <Dock />}
    </>
  );
});

function useIsToolSettingsTab() {
  const activeTabId = React.useContext(ActiveTabIdContext);
  return activeTabId === toolSettingsTabId;
}
