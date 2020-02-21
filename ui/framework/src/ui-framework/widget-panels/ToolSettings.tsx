/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import * as React from "react";
import { DockedToolSettings } from "@bentley/ui-ninezone";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";

/** @internal */
export function WidgetPanelsToolSettings() {
  const frontstageDef = useActiveFrontstageDef();
  const settings = useToolSettings();
  const topCenterZone = frontstageDef?.topCenter;
  if (!topCenterZone || !topCenterZone.isToolSettings)
    return null;
  return (
    <DockedToolSettings>
      {settings}
    </DockedToolSettings>
  );
}

/** @internal */
export function useToolSettings() {
  const [settings, setSettings] = React.useState(FrontstageManager.activeToolSettingsNode);
  React.useEffect(() => {
    const handleToolActivatedEvent = () => {
      setSettings(FrontstageManager.activeToolSettingsNode);
    };
    FrontstageManager.onToolActivatedEvent.addListener(handleToolActivatedEvent);
    return () => {
      FrontstageManager.onToolActivatedEvent.removeListener(handleToolActivatedEvent);
    };
  }, []);
  return settings;
}
