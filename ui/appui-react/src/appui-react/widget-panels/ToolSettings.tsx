/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import "./ToolSettings.scss";
import * as React from "react";
import { DockedToolSetting, DockedToolSettings, ScrollableWidgetContent, ToolSettingsStateContext } from "@itwin/appui-layout-react";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";
import { FrontstageManager } from "../frontstage/FrontstageManager";

/** Defines a ToolSettings property entry.
 * @public
 */
export interface ToolSettingsEntry {
  // label node which potentially can contain a lock node as well.
  labelNode: React.ReactNode;
  // editor entry used to display and edit the property value
  editorNode: React.ReactNode;
}

/** @internal */
// istanbul ignore next - need to work on overflow unit testing
function TsLabel({ children }: { children: React.ReactNode }) {
  return <div className="uif-toolsetting-label-docked-horizontal">{children}</div>;
}

/** @internal */
export function WidgetPanelsToolSettings() {
  const frontstageDef = useActiveFrontstageDef();
  const toolSettings = React.useContext(ToolSettingsStateContext);
  const topCenterZone = frontstageDef?.topCenter;
  if (!topCenterZone || !topCenterZone.isToolSettings || toolSettings.type === "widget")
    return null;
  return (
    <ToolSettingsDockedContent />
  );
}

/** @internal */
export function ToolSettingsDockedContent() {
  const settings = useHorizontalToolSettingNodes();
  // for the overflow to work properly each setting in the DockedToolSettings should be wrapped by a DockedToolSetting component
  return (
    <DockedToolSettings itemId={FrontstageManager.activeToolSettingsProvider?.uniqueId ?? "none"} key={Date.now()}>
      {settings && settings.map((entry, index) => <DockedToolSetting key={index}><TsLabel>{entry.labelNode}</TsLabel>{entry.editorNode}</DockedToolSetting>)}
    </DockedToolSettings>
  );
}

/** @internal */
export function useHorizontalToolSettingNodes() {
  const [settings, setSettings] = React.useState(FrontstageManager.activeToolSettingsProvider?.horizontalToolSettingNodes);

  React.useEffect(() => {
    const handleToolActivatedEvent = () => {
      const nodes = FrontstageManager.activeToolSettingsProvider?.horizontalToolSettingNodes;
      setSettings(nodes);
    };
    FrontstageManager.onToolActivatedEvent.addListener(handleToolActivatedEvent);
    return () => {
      FrontstageManager.onToolActivatedEvent.removeListener(handleToolActivatedEvent);
    };
  }, [setSettings]);

  React.useEffect(() => {
    const handleToolSettingsReloadEvent = () => {
      const nodes = FrontstageManager.activeToolSettingsProvider?.horizontalToolSettingNodes;
      setSettings(nodes);
    };
    FrontstageManager.onToolSettingsReloadEvent.addListener(handleToolSettingsReloadEvent);
    return () => {
      FrontstageManager.onToolSettingsReloadEvent.removeListener(handleToolSettingsReloadEvent);
    };
  }, [setSettings]);

  return settings;
}

/** Defines the ToolSettingsEntry entries that are used to populate a grid layout of ToolSetting properties.
 * Used only when the "Use UI 2.0" setting is true
 * @internal
 */
export interface ToolSettingsGridProps {
  // label node which potentially can contain a lock node as well.
  settings?: ToolSettingsEntry[];
}

/** Component that arranges an array of ToolSettingsEntry items into a two column grid layout.
 * The left column is considered the label column, the right column is considered the property
 * editor column.
 * @internal
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
    </div>
  );
}

/** @internal */
export function useToolSettingsNode() {
  const [settings, setSettings] = React.useState(FrontstageManager.activeToolSettingsProvider?.toolSettingsNode);
  React.useEffect(() => {
    const handleToolActivatedEvent = () => {
      const nodes = FrontstageManager.activeToolSettingsProvider?.toolSettingsNode;
      setSettings(nodes);
    };
    FrontstageManager.onToolActivatedEvent.addListener(handleToolActivatedEvent);
    return () => {
      FrontstageManager.onToolActivatedEvent.removeListener(handleToolActivatedEvent);
    };
  }, [setSettings]);

  React.useEffect(() => {
    const handleToolSettingsReloadEvent = () => {
      const nodes = FrontstageManager.activeToolSettingsProvider?.toolSettingsNode;
      setSettings(nodes);
    };
    FrontstageManager.onToolSettingsReloadEvent.addListener(handleToolSettingsReloadEvent);
    return () => {
      FrontstageManager.onToolSettingsReloadEvent.removeListener(handleToolSettingsReloadEvent);
    };
  }, [setSettings]);

  return settings;
}

/** @internal */
export function ToolSettingsContent() {
  const toolSettings = React.useContext(ToolSettingsStateContext);
  // This is needed to remount underlying components tree when going into widget state.
  if (toolSettings.type === "docked")
    return null;
  return <ToolSettingsWidgetContent />;
}

/** @internal */
export function ToolSettingsWidgetContent() {
  const floatingToolSettingsContainerRef = React.useRef<HTMLDivElement>(null);
  const node = useToolSettingsNode();
  // if no tool settings hide the floating widgets tab
  React.useEffect(() => {
    // istanbul ignore else
    if (floatingToolSettingsContainerRef.current) {
      const floatingWidgetTab = floatingToolSettingsContainerRef.current.closest(".nz-floating-toolsettings");
      // istanbul ignore else
      if (floatingWidgetTab) {
        (floatingWidgetTab as HTMLDivElement).style.visibility = !!node ? "visible" : /* istanbul ignore next */ "hidden";
      }
    }
  }, [node]);

  // istanbul ignore next
  const providerId = FrontstageManager.activeToolSettingsProvider?.uniqueId ?? "none";

  return (
    <div data-toolsettings-provider={providerId} className="uifw-floating-toolsettings-container" ref={floatingToolSettingsContainerRef} >
      <ScrollableWidgetContent>
        {node}
      </ScrollableWidgetContent>
    </div>
  );
}
