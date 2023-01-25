/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Frontstage
 */

import { Logger } from "@itwin/core-bentley";
import { IModelApp, IModelConnection, InteractiveTool, SelectedViewportChangedArgs, StartOrResume, Tool } from "@itwin/core-frontend";
import { WidgetState } from "@itwin/appui-abstract";
import { Size, UiEvent } from "@itwin/core-react";
import { NineZoneManager } from "@itwin/appui-layout-react";
import { ContentControlActivatedEvent } from "../content/ContentControl";
import { ContentGroup } from "../content/ContentGroup";
import { ContentLayoutActivatedEvent, ContentLayoutDef } from "../content/ContentLayout";
import { NavigationAidActivatedEvent } from "../navigationaids/NavigationAidControl";
import { PanelSizeChangedEvent, PanelStateChangedEvent } from "../stagepanels/StagePanelDef";
import { UiFramework } from "../UiFramework";
import { WidgetChangedEventArgs, WidgetDef, WidgetEventArgs, WidgetStateChangedEvent } from "../widgets/WidgetDef";
import { ToolInformation } from "../zones/toolsettings/ToolInformation";
import { SyncToolSettingsPropertiesEventArgs } from "../framework/FrameworkToolSettings";
import { ToolUiProvider } from "../zones/toolsettings/ToolUiProvider";
import { FrontstageDef, FrontstageEventArgs, FrontstageNineZoneStateChangedEventArgs } from "./FrontstageDef";
import { FrontstageProvider } from "./FrontstageProvider";
import { TimeTracker } from "../configurableui/TimeTracker";
import { FrontstageActivatedEvent, FrontstageDeactivatedEvent, FrontstageReadyEvent, ModalFrontstageChangedEvent, ModalFrontstageClosedEvent, ModalFrontstageInfo, ModalFrontstageItem, ModalFrontstageRequestedCloseEvent, ToolActivatedEvent, ToolIconChangedEvent } from "../framework/FrameworkFrontstages";

// -----------------------------------------------------------------------------
// Frontstage Events
// -----------------------------------------------------------------------------

/** Frontstage Manager class.
 * @internal
 */
export class InternalFrontstageManager {
  private static _initialized = false;
  private static _isLoading = false;
  private static _activeToolId = "";
  private static _activeFrontstageDef: FrontstageDef | undefined;
  private static _frontstageDefs = new Map<string, FrontstageDef>();
  private static _modalFrontstages: ModalFrontstageItem[] = new Array<ModalFrontstageItem>();
  private static _nineZoneManagers = new Map<string, NineZoneManager>();
  private static _frontstageProviders = new Map<string, FrontstageProvider>();
  private static _nineZoneSize: Size | undefined = undefined;

  private static _nestedFrontstages: FrontstageDef[] = new Array<FrontstageDef>();
  private static _activePrimaryFrontstageDef: FrontstageDef | undefined;
  private static _toolInformationMap: Map<string, ToolInformation> = new Map<string, ToolInformation>();

  /** This should only be called within InternalFrontstageManager and its tests.
   *  @internal
   */
  public static ensureToolInformationIsSet(toolId: string): void {
    // istanbul ignore else
    if (!InternalFrontstageManager._toolInformationMap.get(toolId))
      InternalFrontstageManager._toolInformationMap.set(toolId, new ToolInformation(toolId));
  }

  // pass on SyncToolSettingsPropertiesEvent from ToolAdmin so they are treated as DialogItemSync events
  private static handleSyncToolSettingsPropertiesEvent(args: SyncToolSettingsPropertiesEventArgs): void {
    InternalFrontstageManager.activeToolSettingsProvider && InternalFrontstageManager.activeToolSettingsProvider.syncToolSettingsProperties(args);
  }

  // pass on ReloadToolSettingsEvent from ToolAdmin so they are treated by UiProviders
  private static handleReloadToolSettingsEvent(): void {
    // istanbul ignore else
    if (InternalFrontstageManager.activeToolSettingsProvider) {
      InternalFrontstageManager.activeToolSettingsProvider.reloadPropertiesFromTool();
    }
  }

  /** Initializes the InternalFrontstageManager
   * @internal
  */
  public static initialize() {
    if (this._initialized)
      return;

    // istanbul ignore else
    if (IModelApp && IModelApp.toolAdmin) {
      IModelApp.toolAdmin.activeToolChanged.addListener((tool: Tool, _start: StartOrResume) => {
        // make sure tool settings properties are cached before creating ToolInformation
        UiFramework.toolSettings.clearToolSettingsData();
        // istanbul ignore else
        if (tool instanceof InteractiveTool)
          UiFramework.toolSettings.initializeDataForTool(tool);

        // if the tool data is not already cached then see if there is data to cache
        InternalFrontstageManager.ensureToolInformationIsSet(tool.toolId);
        InternalFrontstageManager.setActiveTool(tool);
      });
      UiFramework.toolSettings.onSyncToolSettingsProperties.addListener(InternalFrontstageManager.handleSyncToolSettingsPropertiesEvent);
      UiFramework.toolSettings.onReloadToolSettingsProperties.addListener(InternalFrontstageManager.handleReloadToolSettingsEvent);
    }

    // istanbul ignore else
    if (IModelApp && IModelApp.viewManager) {
      IModelApp.viewManager.onSelectedViewportChanged.addListener(InternalFrontstageManager._handleSelectedViewportChanged);
    }

    this._initialized = true;
  }

  /** Handles a Viewport change & sets the active view accordingly */
  private static _handleSelectedViewportChanged = (args: SelectedViewportChangedArgs) => {
    // istanbul ignore else
    if (args.current && InternalFrontstageManager.activeFrontstageDef && !InternalFrontstageManager.isLoading) {
      InternalFrontstageManager.activeFrontstageDef.setActiveViewFromViewport(args.current);
    }
  };

  /** @internal */
  public static get isInitialized(): boolean { return InternalFrontstageManager._initialized; }
  public static set isInitialized(v: boolean) { InternalFrontstageManager._initialized = v; }

  /** Returns true if Frontstage is loading its controls. If false the Frontstage content and controls have been created. */
  public static get isLoading(): boolean { return InternalFrontstageManager._isLoading; }

  /** @internal */
  public static get nineZoneSize() { return InternalFrontstageManager._nineZoneSize; }

  public static set nineZoneSize(size) {
    InternalFrontstageManager._nineZoneSize = size;
  }

  /** @internal */
  public static get frontstageDefs(): ReadonlyMap<string, FrontstageDef> {
    return this._frontstageDefs;
  }

  /** Get Frontstage Deactivated event. */
  public static readonly onFrontstageDeactivatedEvent = new FrontstageDeactivatedEvent();

  /** Get Frontstage Activated event. */
  public static readonly onFrontstageActivatedEvent = new FrontstageActivatedEvent();

  /** Get Frontstage Activated event. */
  public static readonly onFrontstageReadyEvent = new FrontstageReadyEvent();

  /** Get Modal Frontstage Changed event. */
  public static readonly onModalFrontstageChangedEvent = new ModalFrontstageChangedEvent();

  /** Get Modal Frontstage Closed event. */
  public static readonly onModalFrontstageClosedEvent = new ModalFrontstageClosedEvent();

  /** Get Modal Frontstage Requested Closed event.
   * @alpha
   */
  public static readonly onCloseModalFrontstageRequestedEvent = new ModalFrontstageRequestedCloseEvent();

  /** Get Tool Activated event. */
  public static readonly onToolActivatedEvent = new ToolActivatedEvent();

  /** Get ToolSetting Reload event. */
  public static readonly onToolSettingsReloadEvent = new UiEvent<void>();

  /** Get Tool Panel Opened event.
   * @internal
   */
  public static readonly onToolPanelOpenedEvent = new UiEvent<void>();

  /** Get Tool Icon Changed event. */
  public static readonly onToolIconChangedEvent = new ToolIconChangedEvent();

  /** Get Content Layout Activated event. */
  public static readonly onContentLayoutActivatedEvent = new ContentLayoutActivatedEvent();

  /** Get Content Control Activated event. */
  public static readonly onContentControlActivatedEvent = new ContentControlActivatedEvent();

  /** Get Navigation Aid Activated event. */
  public static readonly onNavigationAidActivatedEvent = new NavigationAidActivatedEvent();

  /** Get Widget State Changed event. */
  public static readonly onWidgetStateChangedEvent = new WidgetStateChangedEvent();

  /** @internal */
  public static readonly onWidgetLabelChangedEvent = new UiEvent<WidgetChangedEventArgs>();

  /** @internal */
  public static readonly onWidgetShowEvent = new UiEvent<WidgetEventArgs>();

  /** @internal */
  public static readonly onWidgetExpandEvent = new UiEvent<WidgetEventArgs>();

  /** @internal */
  public static readonly onWidgetDefsUpdatedEvent = new UiEvent<void>();

  /** @internal */
  public static readonly onFrontstageNineZoneStateChangedEvent = new UiEvent<FrontstageNineZoneStateChangedEventArgs>();

  /** @internal */
  public static readonly onFrontstageRestoreLayoutEvent = new UiEvent<FrontstageEventArgs>();

  /** Get Widget State Changed event.
   * @alpha
   */
  public static readonly onPanelStateChangedEvent = new PanelStateChangedEvent();

  /** @internal */
  public static readonly onPanelSizeChangedEvent = new PanelSizeChangedEvent();

  /** Get Nine-zone State Manager.
   * @deprecated Used in UI1.0 only.
   */
  public static get NineZoneManager() {
    const id = InternalFrontstageManager.activeFrontstageId;
    let manager = InternalFrontstageManager._nineZoneManagers.get(id);
    if (!manager) {
      manager = new NineZoneManager();
      InternalFrontstageManager._nineZoneManagers.set(id, manager);
    }
    return manager;
  }

  /** Clears the Frontstage map.
   */
  public static clearFrontstageDefs(): void {
    InternalFrontstageManager._frontstageDefs.clear();
    InternalFrontstageManager._activeFrontstageDef = undefined;
  }

  /** Clears the Frontstage Providers and the defs that may have been created from them.
   */
  public static clearFrontstageProviders(): void {
    InternalFrontstageManager._frontstageProviders.clear();
    InternalFrontstageManager.clearFrontstageDefs();
  }

  private static getFrontstageKey(frontstageId: string) {
    const provider = InternalFrontstageManager._frontstageProviders.get(frontstageId);
    let isIModelIndependent = false;
    if (provider && !provider.frontstageConfig) {
      isIModelIndependent = !!provider.frontstage.props.isIModelIndependent;
    }
    const imodelId = UiFramework.getIModelConnection()?.iModelId ?? "noImodel";
    const key = isIModelIndependent ? frontstageId : `[${imodelId}]${frontstageId}`;
    return key;
  }

  /** @internal */
  public static clearFrontstageDefsForIModelId(iModelId: string | undefined) {
    // istanbul ignore next
    if (!iModelId)
      return;
    const keysToRemove: string[] = [];
    InternalFrontstageManager._frontstageDefs.forEach((_: FrontstageDef, key: string) => {
      if (key.startsWith(`[${iModelId}]`))
        keysToRemove.push(key);
    });
    keysToRemove.forEach((keyValue) => {
      InternalFrontstageManager._frontstageDefs.delete(keyValue);
    });
  }

  /** Add a Frontstage via a [[FrontstageProvider]].
   * @param frontstageProvider  FrontstageProvider representing the Frontstage to add
   */
  public static addFrontstageProvider(frontstageProvider: FrontstageProvider): void {
    const key = InternalFrontstageManager.getFrontstageKey(frontstageProvider.id);
    key && InternalFrontstageManager._frontstageDefs.delete(key);
    InternalFrontstageManager._frontstageProviders.set(frontstageProvider.id, frontstageProvider);
  }

  /** Find a loaded Frontstage with a given id. If the id is not provided, the active Frontstage is returned.
   * If the FrontstageDef has not been cached by FrontstageDef then it will not be found. See async function
   * `getFrontstageDef` to get a FrontstageDef.
   * @param id  Id of the Frontstage to find
   * @returns  FrontstageDef with a given id if found, or undefined if not found.
   */
  private static findFrontstageDef(id: string): FrontstageDef | undefined {
    const key = InternalFrontstageManager.getFrontstageKey(id);
    const frontstageDef = InternalFrontstageManager._frontstageDefs.get(key);
    if (frontstageDef instanceof FrontstageDef)
      return frontstageDef;
    return undefined;
  }

  private static findFrontstageProvider(id?: string): FrontstageProvider | undefined {
    return id ? InternalFrontstageManager._frontstageProviders.get(id) : undefined;
  }

  /** Find a loaded Frontstage with a given id. If the id is not provided, the active Frontstage is returned. If
   * no cached FrontstageDef is found but a FrontstageProvider is registered a FrontstageDef will be created, cached, and
   * returned.
   * @param id  Id of the Frontstage to find
   * @returns  FrontstageDef with a given id if found, or undefined if not found.
   */
  public static async getFrontstageDef(id?: string): Promise<FrontstageDef | undefined> {
    if (!id)
      return InternalFrontstageManager.activeFrontstageDef;

    let frontstageDef = InternalFrontstageManager.findFrontstageDef(id);
    if (frontstageDef)
      return frontstageDef;

    // istanbul ignore else
    if (id) {
      const frontstageProvider = InternalFrontstageManager.findFrontstageProvider(id);
      if (frontstageProvider) {
        frontstageDef = await FrontstageDef.create(frontstageProvider);
        // istanbul ignore else
        if (frontstageDef) {
          const key = InternalFrontstageManager.getFrontstageKey(frontstageDef.id);
          InternalFrontstageManager._frontstageDefs.set(key, frontstageDef);
        }
        return frontstageDef;
      }
    }

    return undefined;
  }

  /** Gets the active FrontstageDef. If a Frontstage is not active, undefined is returned.
   * @return  Active FrontstageDef, or undefined if one is not active.
   */
  public static get activeFrontstageDef(): FrontstageDef | undefined {
    return InternalFrontstageManager._activeFrontstageDef;
  }

  /** Gets the Id of the active FrontstageDef. If a Frontstage is not active, blank is returned.
   * @return  Id of the active FrontstageDef, or blank if one is not active.
   */
  public static get activeFrontstageId(): string {
    const activeFrontstage = InternalFrontstageManager._activeFrontstageDef;
    return (activeFrontstage) ? activeFrontstage.id : "";
  }

  public static hasFrontstage(frontstageId: string) {
    if (InternalFrontstageManager.findFrontstageDef(frontstageId))
      return true;
    if (InternalFrontstageManager.findFrontstageProvider(frontstageId))
      return true;
    return false;
  }

  /** Sets the active FrontstageDef give the stageId.
   * @param  frontstageId  Id of the Frontstage to set active.
   * @returns A Promise that is fulfilled when the [[Frontstage]] is ready.
   */
  public static async setActiveFrontstage(frontstageId: string): Promise<void> {
    const frontstageDef = await InternalFrontstageManager.getFrontstageDef(frontstageId);
    if (!frontstageDef) {
      Logger.logError(UiFramework.loggerCategory(this), `setActiveFrontstage: Could not load a FrontstageDef with id of '${frontstageId}'`);
      return;
    }

    return InternalFrontstageManager.setActiveFrontstageDef(frontstageDef);
  }

  /** Sets the active FrontstageDef.
   * @param  frontstageDef  FrontstageDef to set active.
   * @returns A Promise that is fulfilled when the [[FrontstageDef]] is ready.
   */
  public static async setActiveFrontstageDef(frontstageDef: FrontstageDef | undefined): Promise<void> {
    if (InternalFrontstageManager._activeFrontstageDef === frontstageDef)
      return;

    InternalFrontstageManager._isLoading = true;

    const deactivatedFrontstageDef = InternalFrontstageManager._activeFrontstageDef;
    if (deactivatedFrontstageDef) {
      await deactivatedFrontstageDef.onDeactivated();

      const timeTracker = deactivatedFrontstageDef.timeTracker;
      InternalFrontstageManager.onFrontstageDeactivatedEvent.emit({
        deactivatedFrontstageDef,
        activatedFrontstageDef: frontstageDef,
        totalTime: timeTracker.getTotalTimeSeconds(),
        engagementTime: timeTracker.getEngagementTimeSeconds(),
        idleTime: timeTracker.getIdleTimeSeconds(),
      });
    }

    InternalFrontstageManager._activeFrontstageDef = frontstageDef;

    if (frontstageDef) {
      await frontstageDef.onActivated();

      InternalFrontstageManager.onFrontstageActivatedEvent.emit({ activatedFrontstageDef: frontstageDef, deactivatedFrontstageDef });

      await frontstageDef.waitUntilReady();
      InternalFrontstageManager._isLoading = false;
      frontstageDef.onFrontstageReady();
      InternalFrontstageManager.onFrontstageReadyEvent.emit({ frontstageDef });
      UiFramework.visibility.handleFrontstageReady();

      frontstageDef.startDefaultTool();

      await frontstageDef.setActiveContent();
    }

    InternalFrontstageManager._isLoading = false;
  }

  /** Deactivates the active FrontstageDef.
   */
  public static async deactivateFrontstageDef(): Promise<void> {
    await this.setActiveFrontstageDef(undefined);
  }

  /** Gets the Id of the active tool. If a tool is not active, blank is returned.
   * @return  Id of the active tool, or blank if one is not active.
   */
  public static get activeToolId(): string {
    return InternalFrontstageManager._activeToolId;
  }

  /** Sets the active tool id */
  public static setActiveToolId(toolId: string): void {
    InternalFrontstageManager._activeToolId = toolId;
    const toolSettingsProvider = InternalFrontstageManager.activeToolSettingsProvider;
    // ensure the toolSettingsProvider is initialized before emitting onToolActivatedEvent
    if (toolSettingsProvider)
      toolSettingsProvider.initialize();
    InternalFrontstageManager.onToolActivatedEvent.emit({ toolId });
  }

  /** Sets the active tool */
  public static setActiveTool(tool: Tool): void {
    InternalFrontstageManager.setActiveToolId(tool.toolId);
    InternalFrontstageManager.onToolIconChangedEvent.emit({ iconSpec: tool.iconSpec });
  }

  /** Gets the active tool's [[ToolInformation]] */
  public static get activeToolInformation(): ToolInformation | undefined {
    return InternalFrontstageManager._toolInformationMap.get(InternalFrontstageManager.activeToolId);
  }

  /** Gets the Tool Setting React node of the active tool.
   * @return  Tool Setting React node of the active tool, or undefined if there is no active tool or Tool Settings for the active tool.
   * @internal
   */
  public static get activeToolSettingsProvider(): ToolUiProvider | undefined {
    const activeToolInformation = InternalFrontstageManager.activeToolInformation;
    return (activeToolInformation) ? activeToolInformation.toolUiProvider : /* istanbul ignore next */ undefined;
  }

  /** Sets the active layout, content group and active content.
   * @param contentLayoutDef  Content layout to make active
   * @param contentGroup  Content Group to make active
   */
  public static async setActiveLayout(contentLayoutDef: ContentLayoutDef, contentGroup: ContentGroup): Promise<void> {
    const activeFrontstageDef = InternalFrontstageManager.activeFrontstageDef;
    // istanbul ignore else
    if (activeFrontstageDef) {
      InternalFrontstageManager._isLoading = false;

      activeFrontstageDef.setContentLayoutAndGroup(contentLayoutDef, contentGroup);
      InternalFrontstageManager.onContentLayoutActivatedEvent.emit({ contentLayout: contentLayoutDef, contentGroup });

      await activeFrontstageDef.waitUntilReady();
      InternalFrontstageManager._isLoading = false;

      await activeFrontstageDef.setActiveContent();
    }
  }

  /** Sets the active layout, content group and active content.
   * @param contentGroup  Content Group to make active
   */
  public static async setActiveContentGroup(contentGroup: ContentGroup): Promise<void> {
    const contentLayoutDef = UiFramework.content.layouts.getLayoutForGroup(contentGroup);
    if (contentLayoutDef) {
      await InternalFrontstageManager.setActiveLayout(contentLayoutDef, contentGroup);
    }
  }

  /** Opens a modal Frontstage. Modal Frontstages can be stacked.
   * @param modalFrontstage  Information about the modal Frontstage
   */
  public static openModalFrontstage(modalFrontstage: ModalFrontstageInfo): void {
    InternalFrontstageManager.pushModalFrontstage(modalFrontstage);
  }

  private static pushModalFrontstage(modalFrontstage: ModalFrontstageInfo): void {
    const timeTracker = new TimeTracker();
    timeTracker.startTiming();
    const frontstageItem: ModalFrontstageItem = { modalFrontstage, timeTracker };
    InternalFrontstageManager._modalFrontstages.push(frontstageItem);
    InternalFrontstageManager.emitModalFrontstageChangedEvent();
  }

  /** Closes the top-most modal Frontstage.
   */
  public static closeModalFrontstage(): void {
    // istanbul ignore else
    if (InternalFrontstageManager._modalFrontstages.length > 0) {
      const topMostStageItem = InternalFrontstageManager._modalFrontstages[InternalFrontstageManager._modalFrontstages.length - 1];
      if (topMostStageItem.modalFrontstage.notifyCloseRequest)
        InternalFrontstageManager.onCloseModalFrontstageRequestedEvent.emit(
          {
            modalFrontstage: topMostStageItem.modalFrontstage,
            stageCloseFunc: InternalFrontstageManager.popModalFrontstage,
          });
      else
        InternalFrontstageManager.popModalFrontstage();
    }
  }

  private static popModalFrontstage(): void {
    const frontstageItem = InternalFrontstageManager._modalFrontstages.pop();
    // istanbul ignore else
    if (frontstageItem) {
      const modalFrontstage = frontstageItem.modalFrontstage;
      const timeTracker = frontstageItem.timeTracker;
      timeTracker.stopTiming();
      InternalFrontstageManager.onModalFrontstageClosedEvent.emit({
        modalFrontstage,
        totalTime: timeTracker.getTotalTimeSeconds(),
        engagementTime: timeTracker.getEngagementTimeSeconds(),
        idleTime: timeTracker.getIdleTimeSeconds(),
      });
    }

    InternalFrontstageManager.emitModalFrontstageChangedEvent();

    UiFramework.visibility.handleFrontstageReady();
  }

  private static emitModalFrontstageChangedEvent(): void {
    InternalFrontstageManager.onModalFrontstageChangedEvent.emit({ modalFrontstageCount: InternalFrontstageManager.modalFrontstageCount });
  }

  /** Updates the top-most modal Frontstage.
   */
  public static updateModalFrontstage(): void {
    InternalFrontstageManager.emitModalFrontstageChangedEvent();
  }

  /** Gets the top-most modal Frontstage.
   * @returns Top-most modal Frontstage, or undefined if there is none.
   */
  public static get activeModalFrontstage(): ModalFrontstageInfo | undefined {
    if (InternalFrontstageManager._modalFrontstages.length > 0) {
      const frontstageItem = InternalFrontstageManager._modalFrontstages[InternalFrontstageManager._modalFrontstages.length - 1];
      const modalFrontstage = frontstageItem.modalFrontstage;
      return modalFrontstage;
    } else {
      return undefined;
    }
  }

  /** Gets the number of modal Frontstages.
   * @returns Modal Frontstage count
   */
  public static get modalFrontstageCount(): number {
    return InternalFrontstageManager._modalFrontstages.length;
  }

  /** Sets the active Navigation Aid via its Id.
   * @param navigationAidId  Id of the Navigation Aid to set as active
   * @param iModelConnection IModelConnection to query for view data
   */
  public static setActiveNavigationAid(navigationAidId: string, iModelConnection: IModelConnection) {
    InternalFrontstageManager.onNavigationAidActivatedEvent.emit({ navigationAidId, iModelConnection });
  }

  /** Sets the state of the widget with the given id
   * @param widgetId  Id of the Widget for which to set the state
   * @param state     New state of the widget
   * @returns true if the widget state was set successfully, or false if not.
   */
  public static setWidgetState(widgetId: string, state: WidgetState): boolean {
    const widgetDef = InternalFrontstageManager.findWidget(widgetId);
    if (widgetDef) {
      widgetDef.setWidgetState(state);
      return true;
    } else {
      Logger.logError(UiFramework.loggerCategory(this), `setWidgetState: Could not find Widget with id of '${widgetId}'`);
    }

    return false;
  }

  /** Finds a widget with the given id in the active frontstage
   * @param widgetId  Id of the Widget to find
   * @returns The WidgetDef with the given id, or undefined if not found.
   */
  public static findWidget(widgetId: string): WidgetDef | undefined {
    const activeFrontstageDef = InternalFrontstageManager.activeFrontstageDef;

    // istanbul ignore else
    if (activeFrontstageDef)
      return activeFrontstageDef.findWidgetDef(widgetId);

    return undefined;
  }

  /** Opens a nested Frontstage. Nested Frontstages can be stacked.
   * @param nestedFrontstage  Information about the nested Frontstage
   */
  public static async openNestedFrontstage(nestedFrontstage: FrontstageDef): Promise<void> {
    if (InternalFrontstageManager.nestedFrontstageCount === 0)
      InternalFrontstageManager._activePrimaryFrontstageDef = InternalFrontstageManager._activeFrontstageDef;

    InternalFrontstageManager.pushNestedFrontstage(nestedFrontstage);

    await InternalFrontstageManager.setActiveFrontstageDef(nestedFrontstage);
  }

  private static pushNestedFrontstage(nestedFrontstage: FrontstageDef): void {
    InternalFrontstageManager._nestedFrontstages.push(nestedFrontstage);
  }

  /** Closes the top-most nested Frontstage.
   */
  public static async closeNestedFrontstage(): Promise<void> {
    InternalFrontstageManager.popNestedFrontstage();

    if (InternalFrontstageManager.nestedFrontstageCount > 0) {
      await InternalFrontstageManager.setActiveFrontstageDef(InternalFrontstageManager.activeNestedFrontstage);
    } else {
      await InternalFrontstageManager.setActiveFrontstageDef(InternalFrontstageManager._activePrimaryFrontstageDef);
      InternalFrontstageManager._activePrimaryFrontstageDef = undefined;
    }
  }

  private static popNestedFrontstage(): void {
    InternalFrontstageManager._nestedFrontstages.pop();
  }

  /** Gets the top-most nested Frontstage.
   * @returns Top-most nested Frontstage, or undefined if there is none.
   */
  public static get activeNestedFrontstage(): FrontstageDef | undefined {
    // istanbul ignore else
    if (InternalFrontstageManager._nestedFrontstages.length > 0)
      return InternalFrontstageManager._nestedFrontstages[InternalFrontstageManager._nestedFrontstages.length - 1];

    return undefined;
  }

  /** Gets the number of nested Frontstages.
   * @returns Nested Frontstage count
   */
  public static get nestedFrontstageCount(): number {
    return InternalFrontstageManager._nestedFrontstages.length;
  }

}

