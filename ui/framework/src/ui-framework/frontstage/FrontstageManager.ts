/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import { UiEvent } from "@bentley/ui-core";
import { DefaultStateManager as NineZoneStateManager } from "@bentley/ui-ninezone";
import { IModelConnection, IModelApp, Tool, StartOrResume, InteractiveTool } from "@bentley/imodeljs-frontend";
import { Logger } from "@bentley/bentleyjs-core";

import { FrontstageDef } from "./FrontstageDef";
import { ContentControlActivatedEvent } from "../content/ContentControl";
import { WidgetDef, WidgetState, WidgetStateChangedEvent } from "../widgets/WidgetDef";
import { ToolInformation } from "../zones/toolsettings/ToolInformation";
import { FrontstageProvider } from "./FrontstageProvider";
import { ToolUiManager } from "../zones/toolsettings/ToolUiManager";
import { ContentLayoutActivatedEvent, ContentLayoutDef } from "../content/ContentLayout";
import { NavigationAidActivatedEvent } from "../navigationaids/NavigationAidControl";
import { UiShowHideManager } from "../utils/UiShowHideManager";
import { UiFramework } from "../UiFramework";
import { ContentGroup } from "../content/ContentGroup";

// -----------------------------------------------------------------------------
// Frontstage Events
// -----------------------------------------------------------------------------

/** Frontstage Activated Event Args interface.
 * @public
 */
export interface FrontstageActivatedEventArgs {
  deactivatedFrontstageDef?: FrontstageDef;
  activatedFrontstageDef: FrontstageDef;
}

/** Frontstage Activated Event class.
 * @public
 */
export class FrontstageActivatedEvent extends UiEvent<FrontstageActivatedEventArgs> { }

/** Frontstage Deactivated Event Args interface.
 * @public
 */
export interface FrontstageDeactivatedEventArgs {
  deactivatedFrontstageDef: FrontstageDef;
  activatedFrontstageDef?: FrontstageDef;
}

/** Frontstage Deactivated Event class.
 * @public
 */
export class FrontstageDeactivatedEvent extends UiEvent<FrontstageDeactivatedEventArgs> { }

/** Frontstage Ready Event Args interface.
 * @public
 */
export interface FrontstageReadyEventArgs {
  frontstageDef: FrontstageDef;
}

/** Frontstage Ready Event class.
 * @public
 */
export class FrontstageReadyEvent extends UiEvent<FrontstageReadyEventArgs> { }

/** Modal Frontstage Changed Event Args interface.
 * @public
 */
export interface ModalFrontstageChangedEventArgs {
  modalFrontstageCount: number;
}

/** Modal Frontstage Stack Changed Event class.
 * @public
 */
export class ModalFrontstageChangedEvent extends UiEvent<ModalFrontstageChangedEventArgs> { }

/** Tool Activated Event Args interface.
 * @public
 */
export interface ToolActivatedEventArgs {
  toolId: string;
}

/** Tool Activated Event class.
 * @public
 */
export class ToolActivatedEvent extends UiEvent<ToolActivatedEventArgs> { }

/** Modal Frontstage information interface.
 * @public
 */
export interface ModalFrontstageInfo {
  title: string;
  content: React.ReactNode;
  appBarRight?: React.ReactNode;
}

// -----------------------------------------------------------------------------
// FrontstageManager class
// -----------------------------------------------------------------------------

/** Frontstage Manager class.
 * @public
 */
export class FrontstageManager {
  private static _isLoading = true;
  private static _activeToolId = "";
  private static _activeFrontstageDef: FrontstageDef | undefined;
  private static _frontstageDefs = new Map<string, FrontstageDef>();
  private static _modalFrontstages: ModalFrontstageInfo[] = new Array<ModalFrontstageInfo>();

  private static _nestedFrontstages: FrontstageDef[] = new Array<FrontstageDef>();
  private static _activePrimaryFrontstageDef: FrontstageDef | undefined;
  private static _toolInformationMap: Map<string, ToolInformation> = new Map<string, ToolInformation>();

  /** This should only be caused within FrontstageManager and its tests.
   *  @internal
   */
  public static ensureToolInformationIsSet(toolId: string): void {
    // istanbul ignore else
    if (!FrontstageManager._toolInformationMap.get(toolId))
      FrontstageManager._toolInformationMap.set(toolId, new ToolInformation(toolId));
  }

  /** Initializes the FrontstageManager */
  public static initialize() {
    // istanbul ignore else
    if (IModelApp && IModelApp.toolAdmin) {
      IModelApp.toolAdmin.activeToolChanged.addListener((tool: Tool, _start: StartOrResume) => {
        // make sure toolsettings properties are cached before creating ToolInformation
        ToolUiManager.clearCachedProperties();
        // istanbul ignore else
        if (tool instanceof InteractiveTool)
          ToolUiManager.cachePropertiesForTool(tool);

        // if the tool data is not already cached then see if there is data to cache
        FrontstageManager.ensureToolInformationIsSet(tool.toolId);
        FrontstageManager.setActiveToolId(tool.toolId);
      });
    }
  }

  /** Returns true if Frontstage is loading its controls. If false the Frontstage content and controls have been created. */
  public static get isLoading(): boolean { return FrontstageManager._isLoading; }

  /** Get Frontstage Deactivated event. */
  public static readonly onFrontstageDeactivatedEvent = new FrontstageDeactivatedEvent();

  /** Get Frontstage Activated event. */
  public static readonly onFrontstageActivatedEvent = new FrontstageActivatedEvent();

  /** Get Frontstage Activated event. */
  public static readonly onFrontstageReadyEvent = new FrontstageReadyEvent();

  /** Get Modal Frontstage Changed event. */
  public static readonly onModalFrontstageChangedEvent = new ModalFrontstageChangedEvent();

  /** Get Tool Activated event. */
  public static readonly onToolActivatedEvent = new ToolActivatedEvent();

  /** Get Content Layout Activated event. */
  public static readonly onContentLayoutActivatedEvent = new ContentLayoutActivatedEvent();

  /** Get Content Control Activated event. */
  public static readonly onContentControlActivatedEvent = new ContentControlActivatedEvent();

  /** Get Navigation Aid Activated event. */
  public static readonly onNavigationAidActivatedEvent = new NavigationAidActivatedEvent();

  /** Get Widget State Changed event. */
  public static readonly onWidgetStateChangedEvent = new WidgetStateChangedEvent();

  /** Get  Nine-zone State Manager. */
  public static get NineZoneStateManager() { return NineZoneStateManager; }

  /** Clears the Frontstage map.
   */
  public static clearFrontstageDefs(): void {
    FrontstageManager._frontstageDefs.clear();
  }

  /** Add a Frontstage via a definition.
   * @param frontstageDef  Definition of the Frontstage to add
   */
  private static addFrontstageDef(frontstageDef: FrontstageDef): void {
    FrontstageManager._frontstageDefs.set(frontstageDef.id, frontstageDef);
  }

  /** Add a Frontstage via a [[FrontstageProvider]].
   * @param frontstageProvider  FrontstageProvider representing the Frontstage to add
   */
  public static addFrontstageProvider(frontstageProvider: FrontstageProvider): void {
    FrontstageManager.addFrontstageDef(frontstageProvider.initializeDef());
  }

  /** Find a loaded Frontstage with a given id. If the id is not provided, the active Frontstage is returned.
   * @param id  Id of the Frontstage to find
   * @returns  FrontstageDef with a given id if found, or undefined if not found.
   */
  public static findFrontstageDef(id?: string): FrontstageDef | undefined {
    if (!id)
      return FrontstageManager.activeFrontstageDef;
    const frontstageDef = FrontstageManager._frontstageDefs.get(id);
    if (frontstageDef instanceof FrontstageDef)
      return frontstageDef;
    return undefined;
  }

  /** Gets the active FrontstageDef. If a Frontstage is not active, undefined is returned.
   * @return  Active FrontstageDef, or undefined if one is not active.
   */
  public static get activeFrontstageDef(): FrontstageDef | undefined {
    return FrontstageManager._activeFrontstageDef;
  }

  /** Gets the Id of the active FrontstageDef. If a Frontstage is not active, blank is returned.
   * @return  Id of the active FrontstageDef, or blank if one is not active.
   */
  public static get activeFrontstageId(): string {
    const activeFrontstage = FrontstageManager._activeFrontstageDef;
    return (activeFrontstage) ? activeFrontstage.id : "";
  }

  /** Sets the active FrontstageDef.
   * @param  frontstageId  Id of the Frontstage to set active.
   * @returns A Promise that is fulfilled when the [[Frontstage]] is ready.
   */
  public static async setActiveFrontstage(frontstageId: string): Promise<void> {
    const frontstageDef = FrontstageManager.findFrontstageDef(frontstageId);
    if (!frontstageDef) {
      Logger.logError(UiFramework.loggerCategory(this), `setActiveFrontstage: Could not find Frontstage with id of '${frontstageId}'`);
      return;
    }

    return FrontstageManager.setActiveFrontstageDef(frontstageDef);
  }

  /** Sets the active FrontstageDef.
   * @param  frontstageDef  FrontstageDef to set active.
   * @returns A Promise that is fulfilled when the [[FrontstageDef]] is ready.
   */
  public static async setActiveFrontstageDef(frontstageDef: FrontstageDef | undefined): Promise<void> {
    FrontstageManager._isLoading = true;

    const deactivatedFrontstageDef = FrontstageManager._activeFrontstageDef;
    if (deactivatedFrontstageDef) {
      deactivatedFrontstageDef.onDeactivated();
      FrontstageManager.onFrontstageDeactivatedEvent.emit({ deactivatedFrontstageDef, activatedFrontstageDef: frontstageDef });
    }

    FrontstageManager._activeFrontstageDef = frontstageDef;

    if (frontstageDef) {
      frontstageDef.onActivated();

      FrontstageManager.onFrontstageActivatedEvent.emit({ activatedFrontstageDef: frontstageDef, deactivatedFrontstageDef });

      await frontstageDef.waitUntilReady();
      FrontstageManager._isLoading = false;
      frontstageDef.onFrontstageReady();
      FrontstageManager.onFrontstageReadyEvent.emit({ frontstageDef });
      UiShowHideManager.handleFrontstageReady();

      frontstageDef.startDefaultTool();

      frontstageDef.setActiveContent();
    }
    FrontstageManager._isLoading = false;
  }

  /** Gets the Id of the active tool. If a tool is not active, blank is returned.
   * @return  Id of the active tool, or blank if one is not active.
   */
  public static get activeToolId(): string {
    return FrontstageManager._activeToolId;
  }

  /** Sets the active tool id */
  public static setActiveToolId(toolId: string): void {
    FrontstageManager._activeToolId = toolId;
    FrontstageManager.onToolActivatedEvent.emit({ toolId });
  }

  /** Gets the active tool's [[ToolInformation]] */
  public static get activeToolInformation(): ToolInformation | undefined {
    return FrontstageManager._toolInformationMap.get(FrontstageManager.activeToolId);
  }

  /** Gets the Tool Setting React node of the active tool.
   * @return  Tool Setting React node of the active tool, or undefined if there is no active tool or Tool Settings for the active tool.
   */
  public static get activeToolSettingsNode(): React.ReactNode | undefined {
    const activeToolInformation = FrontstageManager.activeToolInformation;
    const toolUiProvider = (activeToolInformation) ? activeToolInformation.toolUiProvider : /* istanbul ignore next */ undefined;

    if (toolUiProvider && toolUiProvider.toolSettingsNode)
      return toolUiProvider.toolSettingsNode;

    return undefined;
  }

  /** Gets the Tool Assistance React node of the active tool.
   * @return  Tool Assistance React node of the active tool, or undefined if there is no active tool or Tool Assistance for the active tool.
   */
  public static get activeToolAssistanceNode(): React.ReactNode | undefined {
    const activeToolInformation = FrontstageManager.activeToolInformation;
    const toolUiProvider = (activeToolInformation) ? activeToolInformation.toolUiProvider : /* istanbul ignore next */ undefined;

    if (toolUiProvider && toolUiProvider.toolAssistanceNode)
      return toolUiProvider.toolAssistanceNode;

    return undefined;
  }

  /** Sets the active layout, content group and active content.
   * @param contentLayoutDef  Content layout to make active
   * @param contentGroup  Content Group to make active
   */
  public static async setActiveLayout(contentLayoutDef: ContentLayoutDef, contentGroup: ContentGroup): Promise<void> {
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
    if (activeFrontstageDef) {
      FrontstageManager._isLoading = false;

      activeFrontstageDef.setContentLayoutAndGroup(contentLayoutDef, contentGroup);
      FrontstageManager.onContentLayoutActivatedEvent.emit({ contentLayout: contentLayoutDef, contentGroup });

      await activeFrontstageDef.waitUntilReady();
      FrontstageManager._isLoading = false;

      activeFrontstageDef.setActiveContent();
    }
  }

  /** Opens a modal Frontstage. Modal Frontstages can be stacked.
   * @param modalFrontstage  Information about the modal Frontstage
   */
  public static openModalFrontstage(modalFrontstage: ModalFrontstageInfo): void {
    FrontstageManager.pushModalFrontstage(modalFrontstage);
  }

  private static pushModalFrontstage(modalFrontstage: ModalFrontstageInfo): void {
    FrontstageManager._modalFrontstages.push(modalFrontstage);
    FrontstageManager.emitModalFrontstageChangedEvent();
  }

  /** Closes the top-most modal Frontstage.
   */
  public static closeModalFrontstage(): void {
    FrontstageManager.popModalFrontstage();
  }

  private static popModalFrontstage(): void {
    FrontstageManager._modalFrontstages.pop();
    FrontstageManager.emitModalFrontstageChangedEvent();

    UiShowHideManager.handleFrontstageReady();
  }

  private static emitModalFrontstageChangedEvent(): void {
    FrontstageManager.onModalFrontstageChangedEvent.emit({ modalFrontstageCount: FrontstageManager.modalFrontstageCount });
  }

  /** Updates the top-most modal Frontstage.
   */
  public static updateModalFrontstage(): void {
    FrontstageManager.emitModalFrontstageChangedEvent();
  }

  /** Gets the top-most modal Frontstage.
   * @returns Top-most modal Frontstage, or undefined if there is none.
   */
  public static get activeModalFrontstage(): ModalFrontstageInfo | undefined {
    if (FrontstageManager._modalFrontstages.length > 0)
      return FrontstageManager._modalFrontstages[FrontstageManager._modalFrontstages.length - 1];

    return undefined;
  }

  /** Gets the number of modal Frontstages.
   * @returns Modal Frontstage count
   */
  public static get modalFrontstageCount(): number {
    return FrontstageManager._modalFrontstages.length;
  }

  /** Sets the active Navigation Aid via its Id.
   * @param navigationAidId  Id of the Navigation Aid to set as active
   * @param iModelConnection IModelConnection to query for view data
   */
  public static setActiveNavigationAid(navigationAidId: string, iModelConnection: IModelConnection) {
    FrontstageManager.onNavigationAidActivatedEvent.emit({ navigationAidId, iModelConnection });
  }

  /** Sets the state of the widget with the given id
   * @param widgetId  Id of the Widget for which to set the state
   * @param state     New state of the widget
   * @returns true if the widget state was set successfully, or false if not.
   */
  public static setWidgetState(widgetId: string, state: WidgetState): boolean {
    const widgetDef = FrontstageManager.findWidget(widgetId);
    if (widgetDef) {
      widgetDef.setWidgetState(state);
      return true;
    } else {
      Logger.logError(UiFramework.loggerCategory(this), `setWidgetState: Could not find Widget with id of '${widgetId}'`);
    }

    return false;
  }

  /** Sets the state of the widget with the given id
   * @param widgetId  Id of the Widget for which to set the state
   * @returns The WidgetDef with the given id, or undefined if not found.
   */
  public static findWidget(widgetId: string): WidgetDef | undefined {
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;

    // istanbul ignore else
    if (activeFrontstageDef)
      return activeFrontstageDef.findWidgetDef(widgetId);

    return undefined;
  }

  /** Opens a nested Frontstage. Nested Frontstages can be stacked.
   * @param nestedFrontstage  Information about the nested Frontstage
   */
  public static async openNestedFrontstage(nestedFrontstage: FrontstageDef): Promise<void> {
    if (FrontstageManager.nestedFrontstageCount === 0)
      FrontstageManager._activePrimaryFrontstageDef = FrontstageManager._activeFrontstageDef;

    FrontstageManager.pushNestedFrontstage(nestedFrontstage);

    await FrontstageManager.setActiveFrontstageDef(nestedFrontstage);
  }

  private static pushNestedFrontstage(nestedFrontstage: FrontstageDef): void {
    FrontstageManager._nestedFrontstages.push(nestedFrontstage);
  }

  /** Closes the top-most nested Frontstage.
   */
  public static async closeNestedFrontstage(): Promise<void> {
    FrontstageManager.popNestedFrontstage();

    if (FrontstageManager.nestedFrontstageCount > 0) {
      await FrontstageManager.setActiveFrontstageDef(FrontstageManager.activeNestedFrontstage);
    } else {
      await FrontstageManager.setActiveFrontstageDef(FrontstageManager._activePrimaryFrontstageDef);
      FrontstageManager._activePrimaryFrontstageDef = undefined;
    }
  }

  private static popNestedFrontstage(): void {
    FrontstageManager._nestedFrontstages.pop();
  }

  /** Gets the top-most nested Frontstage.
   * @returns Top-most nested Frontstage, or undefined if there is none.
   */
  public static get activeNestedFrontstage(): FrontstageDef | undefined {
    // istanbul ignore else
    if (FrontstageManager._nestedFrontstages.length > 0)
      return FrontstageManager._nestedFrontstages[FrontstageManager._nestedFrontstages.length - 1];

    return undefined;
  }

  /** Gets the number of nested Frontstages.
   * @returns Nested Frontstage count
   */
  public static get nestedFrontstageCount(): number {
    return FrontstageManager._nestedFrontstages.length;
  }

}
