/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import { UiEvent } from "@bentley/ui-core";
import { IModelApp, ToolSettingsPropertyRecord, ToolSettingsPropertySyncItem, InteractiveTool } from "@bentley/imodeljs-frontend";
import { Logger } from "@bentley/bentleyjs-core";
import { UiFramework } from "../../UiFramework";

// -----------------------------------------------------------------------------
// Events
// -----------------------------------------------------------------------------

/** Sync Tool Settings Properties Event Args interface.
 * @public
 */
export interface SyncToolSettingsPropertiesEventArgs {
  toolId: string;
  syncProperties: ToolSettingsPropertySyncItem[];
}

/** Sync Tool Settings Properties Event class.
 * @public
 */
export class SyncToolSettingsPropertiesEvent extends UiEvent<SyncToolSettingsPropertiesEventArgs> { }

// -----------------------------------------------------------------------------
// ToolUiManager class
// -----------------------------------------------------------------------------

/** Tool UI Manager class. Used to generate UI components for Tool Settings.
 * @internal
 */
export class ToolUiManager {
  private static _useDefaultToolSettingsProvider = false;
  private static _toolSettings: ToolSettingsPropertyRecord[] = [];
  private static _toolIdForCachedProperties: string = "";
  private static _activeToolLabel: string = "";
  private static _activeToolDescription: string = "";

  private static syncToolSettingsProperties(toolId: string, syncProperties: ToolSettingsPropertySyncItem[]): void {
    // istanbul ignore if
    if (toolId !== ToolUiManager._toolIdForCachedProperties) {
      Logger.logError(UiFramework.loggerCategory(this), `Sync tool with UI - ToolId ${toolId} does not match id of cached properties ${ToolUiManager._toolIdForCachedProperties}}`);
      return;
    }

    ToolUiManager.onSyncToolSettingsProperties.emit({ toolId, syncProperties });
  }

  /** Initializes the ToolUiManager */
  public static initialize() {
    if (IModelApp && IModelApp.toolAdmin) {
      IModelApp.toolAdmin.toolSettingsChangeHandler = ToolUiManager.syncToolSettingsProperties;
    }
  }

  /** clear cached Tool Settings properties. */
  public static clearCachedProperties() {
    ToolUiManager._toolSettings = [];
    ToolUiManager.useDefaultToolSettingsProvider = false;
    ToolUiManager._activeToolLabel = "";
    ToolUiManager._activeToolDescription = "";
    ToolUiManager._toolIdForCachedProperties = "";
  }

  /** Cache Tool Settings properties */
  public static cacheToolSettingsProperties(toolSettingsProperties: ToolSettingsPropertyRecord[] | undefined, toolId?: string, toolLabel?: string, toolDescription?: string): boolean {
    ToolUiManager.clearCachedProperties();
    // istanbul ignore else
    if (toolLabel)
      ToolUiManager._activeToolLabel = toolLabel;

    // istanbul ignore else
    if (toolDescription)
      ToolUiManager._activeToolDescription = toolDescription;

    /* istanbul ignore else */
    if (toolSettingsProperties && toolSettingsProperties.length > 0) {
      // istanbul ignore else
      if (toolId)
        ToolUiManager._toolIdForCachedProperties = toolId;

      ToolUiManager._useDefaultToolSettingsProvider = true;
      ToolUiManager._toolSettings = toolSettingsProperties;
      return true;
    }
    return false;
  }

  /** Cache Tool Settings properties for the specified tool. The tool specified should be the active tool, since only one active tool is support
   * the cache only ever contains the properties of one tool.
   */
  public static cachePropertiesForTool(tool: InteractiveTool) {
    ToolUiManager.cacheToolSettingsProperties(tool.supplyToolSettingsProperties(), tool.toolId, tool.flyover, tool.description);
  }

  /** Returns the toolSettings properties that can be used to populate the tool settings widget. */
  public static get toolSettingsProperties(): ToolSettingsPropertyRecord[] { return ToolUiManager._toolSettings; }

  /** Returns true if the Tool Settings are to be auto populated from the toolSettingsProperties. */
  public static get useDefaultToolSettingsProvider(): boolean { return ToolUiManager._useDefaultToolSettingsProvider; }

  /** @internal for use only by testing  */
  public static set useDefaultToolSettingsProvider(useDefaultToolSettings: boolean) { ToolUiManager._useDefaultToolSettingsProvider = useDefaultToolSettings; }

  /** Returns the name label of the active tool. */
  public static get activeToolLabel(): string { return ToolUiManager._activeToolLabel; }

  /** Set the name of the active tool. This is typically the flyover text specified for the Tool. */
  public static set activeToolLabel(label: string) { ToolUiManager._activeToolLabel = label; }

  /** Returns the description of the active tool. */
  public static get activeToolDescription(): string { return ToolUiManager._activeToolDescription; }

  /** Get ToolSettings Properties sync event. */
  public static readonly onSyncToolSettingsProperties = new SyncToolSettingsPropertiesEvent();

  /** Gets the Id of the active tool. If a tool is not active, blank is returned.
   * @return  Id of the active tool, or blank if one is not active.
   */
  public static get toolIdForCachedProperties(): string {
    return ToolUiManager._toolIdForCachedProperties;
  }

}
