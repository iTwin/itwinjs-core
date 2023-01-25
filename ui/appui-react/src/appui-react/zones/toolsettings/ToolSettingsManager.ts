/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import { InteractiveTool } from "@itwin/core-frontend";
import { DialogItem, UiEvent } from "@itwin/appui-abstract";
import { SyncToolSettingsPropertiesEvent } from "../../framework/FrameworkToolSettings";
import { InternalToolSettingsManager as internal } from "./InternalToolSettingsManager";

/** Tool Settings Manager class. Used to generate UI components for Tool Settings.
 * @public
 * @deprecated in 3.6. Use `UiFramework.toolSettings` property.
 */
export class ToolSettingsManager {
  /** Initializes the ToolSettingsManager
   * @deprecated in 3.6. This is called internally.
   */
  public static initialize() {
    return internal.initialize();
  }

  /** clear cached Tool Settings properties. */
  public static clearToolSettingsData() {
    return internal.clearToolSettingsData();
  }

  /** Cache Tool Settings properties */
  public static initializeToolSettingsData(toolSettingsProperties: DialogItem[] | undefined, toolId?: string, toolLabel?: string, toolDescription?: string): boolean {
    return internal.initializeToolSettingsData(toolSettingsProperties, toolId, toolLabel, toolDescription);
  }

  /** Set of data used in Tool Settings for the specified tool. The tool specified should be the "active" tool.
   */
  public static initializeDataForTool(tool: InteractiveTool): void {
    return internal.initializeDataForTool(tool);
  }

  /** Returns the toolSettings properties that can be used to populate the tool settings widget. */
  public static get toolSettingsProperties(): DialogItem[] {
    return internal.toolSettingsProperties;
  }

  /** Returns true if the Tool Settings are to be auto populated from the toolSettingsProperties.
   * The setter is chiefly for testing.
   */
  public static get useDefaultToolSettingsProvider(): boolean { return internal.useDefaultToolSettingsProvider; }
  public static set useDefaultToolSettingsProvider(useDefaultToolSettings: boolean) { internal.useDefaultToolSettingsProvider = useDefaultToolSettings; }

  /** The name of the active tool. This is typically the flyover text specified for the tool. */
  public static get activeToolLabel(): string { return internal.activeToolLabel; }
  public static set activeToolLabel(label: string) { internal.activeToolLabel = label; }

  /** Returns the description of the active tool. */
  public static get activeToolDescription(): string { return internal.activeToolDescription; }

  /** Get ToolSettings Properties sync event. */
  public static get onSyncToolSettingsProperties(): SyncToolSettingsPropertiesEvent { return internal.onSyncToolSettingsProperties; }
  public static get onReloadToolSettingsProperties(): UiEvent<void> { return internal.onReloadToolSettingsProperties; }

  /** Gets the Id of the active tool. If a tool is not active, blank is returned.
   * @return  Id of the active tool, or blank if one is not active.
   */
  public static get toolIdForToolSettings(): string {
    return internal.toolIdForToolSettings;
  }

  public static focusIntoToolSettings(): boolean {
    return internal.focusIntoToolSettings();
  }
}
