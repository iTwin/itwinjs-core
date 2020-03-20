/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import * as React from "react";
import { DockedToolSettings, DockedToolSetting } from "@bentley/ui-ninezone";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";
import "./ToolSettings.scss";

/** Defines a ToolSettings property entry.
 * @beta
 */
export interface ToolSettingsEntry {
  // label node which potentially can contain a lock node as well.
  labelNode: React.ReactNode;
  // editor entry used to display and edit the property value
  editorNode: React.ReactNode;
}

/** @internal */
function TsLabel({ children }: { children: React.ReactNode }) {
  return <div className="uif-toolsetting-label-docked-horizontal">{children}</div>;
}

/** @internal */
export function WidgetPanelsToolSettings() {
  const frontstageDef = useActiveFrontstageDef();
  const settings = useToolSettings();
  const topCenterZone = frontstageDef?.topCenter;
  if (!topCenterZone || !topCenterZone.isToolSettings)
    return null;
  // for the overflow to work properly each setting in the DockedToolSettings should be wrapped by a DockedToolSetting component
  return (
    <DockedToolSettings>
      {settings && settings.map((entry, index) => <DockedToolSetting key={index}><TsLabel>{entry.labelNode}</TsLabel>{entry.editorNode}</DockedToolSetting>)}
    </DockedToolSettings>
  );
}

/** @internal */
export function useToolSettings() {
  const [settings, setSettings] = React.useState(FrontstageManager.activeToolSettingsProvider?.horizontalToolSettingNodes);

  React.useEffect(() => {
    const handleToolActivatedEvent = () => {
      setSettings(FrontstageManager.activeToolSettingsProvider?.horizontalToolSettingNodes);
    };
    FrontstageManager.onToolActivatedEvent.addListener(handleToolActivatedEvent);
    return () => {
      FrontstageManager.onToolActivatedEvent.removeListener(handleToolActivatedEvent);
    };
  }, []);
  return settings;
}

/** Defines the ToolSettingsEntry entries that are used to populate a grid layout of ToolSetting properties.
 * @beta
 */
export interface ToolSettingsGridProps {
  // label node which potentially can contain a lock node as well.
  settings?: ToolSettingsEntry[];
}

/** Component that arranges an array of ToolSettingsEntry items into a two column grid layout.
 * The left column is considered the label column, the right column is considered the property
 * editor column.
 * @beta
 */
export function ToolSettingsGrid({ settings }: ToolSettingsGridProps) {
  return (
    <div className="uifw-standard-toolsettings-two-column-grid">
      {settings && settings.map((setting: ToolSettingsEntry, index: number) => {
        return (
          <React.Fragment key={index}>
            <span className="uifw-standard-toolsettings-label-entry">{setting.labelNode}</span>
            {setting.editorNode}
          </React.Fragment>
        );
      })}
    </div >
  );
}
