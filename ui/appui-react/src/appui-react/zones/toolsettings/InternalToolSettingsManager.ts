/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import { IModelApp, InteractiveTool } from "@itwin/core-frontend";
import { DialogItem, DialogPropertySyncItem, UiEvent } from "@itwin/appui-abstract";
import { focusIntoContainer } from "@itwin/core-react";
import { UiFramework } from "../../UiFramework";
import { SyncToolSettingsPropertiesEvent } from "../../framework/FrameworkToolSettings";

/** Tool Settings Manager class. Used to generate UI components for Tool Settings.
 * @internal
 */
export class InternalToolSettingsManager {
  private static _useDefaultToolSettingsProvider = false;
  private static _toolIdForToolSettings: string = "";
  private static _activeToolLabel: string = "";
  private static _activeToolDescription: string = "";

  // istanbul ignore next
  private static syncToolSettingsProperties(toolId: string, syncProperties: DialogPropertySyncItem[]): void {
    InternalToolSettingsManager.onSyncToolSettingsProperties.emit({ toolId, syncProperties });
  }

  // istanbul ignore next
  private static reloadToolSettingsProperties(): void {
    InternalToolSettingsManager.onReloadToolSettingsProperties.emit();
  }

  private static dispatchSyncUiEvent(syncEventId: string, useImmediateDispatch?: boolean): void {
    if (useImmediateDispatch)
      UiFramework.events.dispatchImmediateSyncUiEvent(syncEventId);
    else
      UiFramework.events.dispatchSyncUiEvent(syncEventId);
  }

  /** Initializes the ToolSettingsManager
   * @internal
   */
  public static initialize() {
    // istanbul ignore else
    if (IModelApp && IModelApp.toolAdmin) {
      IModelApp.toolAdmin.toolSettingsChangeHandler = InternalToolSettingsManager.syncToolSettingsProperties;
      IModelApp.toolAdmin.reloadToolSettingsHandler = InternalToolSettingsManager.reloadToolSettingsProperties;
      IModelApp.toolAdmin.toolSyncUiEventDispatcher = InternalToolSettingsManager.dispatchSyncUiEvent;
    }
  }

  /** clear cached Tool Settings properties. */
  public static clearToolSettingsData() {
    InternalToolSettingsManager.useDefaultToolSettingsProvider = false;
    InternalToolSettingsManager._activeToolLabel = "";
    InternalToolSettingsManager._activeToolDescription = "";
    InternalToolSettingsManager._toolIdForToolSettings = "";
  }

  /** Cache Tool Settings properties */
  public static initializeToolSettingsData(toolSettingsProperties: DialogItem[] | undefined, toolId?: string, toolLabel?: string, toolDescription?: string): boolean {
    InternalToolSettingsManager.clearToolSettingsData();
    // istanbul ignore else
    if (toolLabel)
      InternalToolSettingsManager._activeToolLabel = toolLabel;

    // istanbul ignore else
    if (toolDescription)
      InternalToolSettingsManager._activeToolDescription = toolDescription;

    /* istanbul ignore else */
    if (toolSettingsProperties && toolSettingsProperties.length > 0) {
      // istanbul ignore else
      if (toolId)
        InternalToolSettingsManager._toolIdForToolSettings = toolId;

      InternalToolSettingsManager._useDefaultToolSettingsProvider = true;
      return true;
    }
    return false;
  }

  /** Set of data used in Tool Settings for the specified tool. The tool specified should be the "active" tool.
   */
  public static initializeDataForTool(tool: InteractiveTool) {
    InternalToolSettingsManager.initializeToolSettingsData(tool.supplyToolSettingsProperties(), tool.toolId, tool.flyover, tool.description);
  }

  /** Returns the toolSettings properties that can be used to populate the tool settings widget. */
  public static get toolSettingsProperties(): DialogItem[] {
    if (IModelApp.toolAdmin && IModelApp.toolAdmin.activeTool && IModelApp.toolAdmin.activeTool.toolId === InternalToolSettingsManager._toolIdForToolSettings) {
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
  public static get useDefaultToolSettingsProvider(): boolean { return InternalToolSettingsManager._useDefaultToolSettingsProvider; }
  public static set useDefaultToolSettingsProvider(useDefaultToolSettings: boolean) { InternalToolSettingsManager._useDefaultToolSettingsProvider = useDefaultToolSettings; }

  /** The name of the active tool. This is typically the flyover text specified for the tool. */
  public static get activeToolLabel(): string { return InternalToolSettingsManager._activeToolLabel; }
  public static set activeToolLabel(label: string) { InternalToolSettingsManager._activeToolLabel = label; }

  /** Returns the description of the active tool. */
  public static get activeToolDescription(): string { return InternalToolSettingsManager._activeToolDescription; }

  /** Get ToolSettings Properties sync event. */
  public static readonly onSyncToolSettingsProperties = new SyncToolSettingsPropertiesEvent();
  public static readonly onReloadToolSettingsProperties = new UiEvent<void>();

  /** Gets the Id of the active tool. If a tool is not active, blank is returned.
   * @return  Id of the active tool, or blank if one is not active.
   */
  public static get toolIdForToolSettings(): string {
    return InternalToolSettingsManager._toolIdForToolSettings;
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
