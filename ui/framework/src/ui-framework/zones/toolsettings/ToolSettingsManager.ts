/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import { IModelApp, InteractiveTool } from "@bentley/imodeljs-frontend";
import { DialogItem, DialogPropertySyncItem } from "@bentley/ui-abstract";
import { focusIntoContainer, UiEvent } from "@bentley/ui-core";
import { SyncUiEventDispatcher } from "../../syncui/SyncUiEventDispatcher";

// -----------------------------------------------------------------------------
// Events
// -----------------------------------------------------------------------------

/** Sync Tool Settings Properties Event Args interface.
 * @public
 */
export interface SyncToolSettingsPropertiesEventArgs {
  toolId: string;
  syncProperties: DialogPropertySyncItem[];
}

/** Sync Tool Settings Properties Event class.
 * @public
 */
export class SyncToolSettingsPropertiesEvent extends UiEvent<SyncToolSettingsPropertiesEventArgs> { }

// -----------------------------------------------------------------------------
// ToolSettingsManager class
// -----------------------------------------------------------------------------

/** Tool Settings Manager class. Used to generate UI components for Tool Settings.
 * @beta
 */
export class ToolSettingsManager {
  private static _useDefaultToolSettingsProvider = false;
  private static _toolIdForToolSettings: string = "";
  private static _activeToolLabel: string = "";
  private static _activeToolDescription: string = "";

  // istanbul ignore next
  private static syncToolSettingsProperties(toolId: string, syncProperties: DialogPropertySyncItem[]): void {
    ToolSettingsManager.onSyncToolSettingsProperties.emit({ toolId, syncProperties });
  }

  // istanbul ignore next
  private static reloadToolSettingsProperties(): void {
    ToolSettingsManager.onReloadToolSettingsProperties.emit();
  }

  private static dispatchSyncUiEvent(syncEventId: string, useImmediateDispatch?: boolean): void {
    if (useImmediateDispatch)
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(syncEventId);
    else
      SyncUiEventDispatcher.dispatchSyncUiEvent(syncEventId);
  }

  /** Initializes the ToolSettingsManager */
  public static initialize() {
    // istanbul ignore else
    if (IModelApp && IModelApp.toolAdmin) {
      IModelApp.toolAdmin.toolSettingsChangeHandler = ToolSettingsManager.syncToolSettingsProperties;
      IModelApp.toolAdmin.reloadToolSettingsHandler = ToolSettingsManager.reloadToolSettingsProperties;
      IModelApp.toolAdmin.toolSyncUiEventDispatcher = ToolSettingsManager.dispatchSyncUiEvent;
    }
  }

  /** clear cached Tool Settings properties. */
  public static clearToolSettingsData() {
    ToolSettingsManager.useDefaultToolSettingsProvider = false;
    ToolSettingsManager._activeToolLabel = "";
    ToolSettingsManager._activeToolDescription = "";
    ToolSettingsManager._toolIdForToolSettings = "";
  }

  /** Cache Tool Settings properties */
  public static initializeToolSettingsData(toolSettingsProperties: DialogItem[] | undefined, toolId?: string, toolLabel?: string, toolDescription?: string): boolean {
    ToolSettingsManager.clearToolSettingsData();
    // istanbul ignore else
    if (toolLabel)
      ToolSettingsManager._activeToolLabel = toolLabel;

    // istanbul ignore else
    if (toolDescription)
      ToolSettingsManager._activeToolDescription = toolDescription;

    /* istanbul ignore else */
    if (toolSettingsProperties && toolSettingsProperties.length > 0) {
      // istanbul ignore else
      if (toolId)
        ToolSettingsManager._toolIdForToolSettings = toolId;

      ToolSettingsManager._useDefaultToolSettingsProvider = true;
      return true;
    }
    return false;
  }

  /** Set of data used in Tool Settings for the specified tool. The tool specified should be the "active" tool.
   */
  public static initializeDataForTool(tool: InteractiveTool) {
    ToolSettingsManager.initializeToolSettingsData(tool.supplyToolSettingsProperties(), tool.toolId, tool.flyover, tool.description);
  }

  /** Returns the toolSettings properties that can be used to populate the tool settings widget. */
  public static get toolSettingsProperties(): DialogItem[] {
    if (IModelApp.toolAdmin && IModelApp.toolAdmin.activeTool && IModelApp.toolAdmin.activeTool.toolId === ToolSettingsManager._toolIdForToolSettings) {
      const properties = IModelApp.toolAdmin.activeTool.supplyToolSettingsProperties();
      // istanbul ignore else
      if (properties)
        return properties;
    }

    return [];
  }

  /** Returns true if the Tool Settings are to be auto populated from the toolSettingsProperties.
   * The setter is chiefly for testing.
   */
  public static get useDefaultToolSettingsProvider(): boolean { return ToolSettingsManager._useDefaultToolSettingsProvider; }
  public static set useDefaultToolSettingsProvider(useDefaultToolSettings: boolean) { ToolSettingsManager._useDefaultToolSettingsProvider = useDefaultToolSettings; }

  /** The name of the active tool. This is typically the flyover text specified for the tool. */
  public static get activeToolLabel(): string { return ToolSettingsManager._activeToolLabel; }
  public static set activeToolLabel(label: string) { ToolSettingsManager._activeToolLabel = label; }

  /** Returns the description of the active tool. */
  public static get activeToolDescription(): string { return ToolSettingsManager._activeToolDescription; }

  /** Get ToolSettings Properties sync event. */
  public static readonly onSyncToolSettingsProperties = new SyncToolSettingsPropertiesEvent();
  public static readonly onReloadToolSettingsProperties = new UiEvent<void>();

  /** Gets the Id of the active tool. If a tool is not active, blank is returned.
   * @return  Id of the active tool, or blank if one is not active.
   */
  public static get toolIdForToolSettings(): string {
    return ToolSettingsManager._toolIdForToolSettings;
  }

  public static focusIntoToolSettings(): boolean {
    let divElement = document.querySelector("div.nz-toolSettings-docked");
    if (divElement) {
      if (focusIntoContainer(divElement as HTMLDivElement))
        return true;
    }

    divElement = document.querySelector("div.uifw-tool-settings-grid-container");
    if (divElement) {
      if (focusIntoContainer(divElement as HTMLDivElement))
        return true;
    }

    return false;
  }
}
