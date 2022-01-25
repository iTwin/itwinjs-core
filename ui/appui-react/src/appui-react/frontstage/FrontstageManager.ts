/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Frontstage
 */

import * as React from "react";
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
import { UiShowHideManager } from "../utils/UiShowHideManager";
import { WidgetChangedEventArgs, WidgetDef, WidgetEventArgs, WidgetStateChangedEvent } from "../widgets/WidgetDef";
import { ToolInformation } from "../zones/toolsettings/ToolInformation";
import { SyncToolSettingsPropertiesEventArgs, ToolSettingsManager } from "../zones/toolsettings/ToolSettingsManager";
import { ToolUiProvider } from "../zones/toolsettings/ToolUiProvider";
import { FrontstageDef, FrontstageEventArgs, FrontstageNineZoneStateChangedEventArgs } from "./FrontstageDef";
import { FrontstageProvider } from "./FrontstageProvider";
import { TimeTracker } from "../configurableui/TimeTracker";
import { ContentLayoutManager } from "../content/ContentLayoutManager";

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
  /** Frontstage being deactivated */
  deactivatedFrontstageDef: FrontstageDef;
  /** Frontstage being activated */
  activatedFrontstageDef?: FrontstageDef;

  /** Total time spent in frontstage */
  totalTime: number;
  /** Engagement time spent in frontstage */
  engagementTime: number;
  /** Idle time spent in frontstage */
  idleTime: number;
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

/** Modal Frontstage Closed Event Args interface.
 * @public
 */
export interface ModalFrontstageClosedEventArgs {
  /** Modal Frontstage being closed */
  modalFrontstage: ModalFrontstageInfo;

  /** Total time spent in frontstage */
  totalTime: number;
  /** Engagement time spent in frontstage */
  engagementTime: number;
  /** Idle time spent in frontstage */
  idleTime: number;
}

/** Modal Frontstage Requested Close Event class. Notifies the modal stage that the close button was
 * pressed and passes the function to actually close the modal stage. This allows stage to do any
 * saving of unsaved data prior to closing the stage. If the ModalFrontstageInfo sets notifyCloseRequest
 * to true it is up to the stage to register for this event and call the stageCloseFunc once it has saved
 * any unsaved data.
 * @alpha
 */
export class ModalFrontstageRequestedCloseEvent extends UiEvent<ModalFrontstageRequestedCloseEventArgs> { }

/** Modal Frontstage RequestedClose Event Args interface.
 * @alpha
 */
export interface ModalFrontstageRequestedCloseEventArgs {
  /** Modal Frontstage that is to be closed */
  modalFrontstage: ModalFrontstageInfo;
  /** Function to call to close the stage */
  stageCloseFunc: () => void;
}

/** Modal Frontstage Closed Event class.
 * @public
 */
export class ModalFrontstageClosedEvent extends UiEvent<ModalFrontstageClosedEventArgs> { }

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

/** Tool Icon Changed Event Args interface.
 * @public
 */
export interface ToolIconChangedEventArgs {
  iconSpec: string;
}

/** Tool Icon Changed Event class.
 * @public
 */
export class ToolIconChangedEvent extends UiEvent<ToolIconChangedEventArgs> { }

/** Modal Frontstage information interface.
 * @public
 */
export interface ModalFrontstageInfo {
  title: string;
  content: React.ReactNode;
  appBarRight?: React.ReactNode;
  /** Set notifyCloseRequest to true on stages that register to listen for `onCloseModalFrontstageRequestedEvent` so
   * that the stage can save unsaved data before closing. Used by the ModalSettingsStage.
   * @alpha */
  notifyCloseRequest?: boolean;
}

/** Modal Frontstage array item interface.
 * @internal
 */
interface ModalFrontstageItem {
  modalFrontstage: ModalFrontstageInfo;
  timeTracker: TimeTracker;
}

// -----------------------------------------------------------------------------
// FrontstageManager class
// -----------------------------------------------------------------------------

/** Frontstage Manager class.
 * @public
 */
export class FrontstageManager {
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

  /** This should only be called within FrontstageManager and its tests.
   *  @internal
   */
  public static ensureToolInformationIsSet(toolId: string): void {
    // istanbul ignore else
    if (!FrontstageManager._toolInformationMap.get(toolId))
      FrontstageManager._toolInformationMap.set(toolId, new ToolInformation(toolId));
  }

  // pass on SyncToolSettingsPropertiesEvent from ToolAdmin so they are treated as DialogItemSync events
  private static handleSyncToolSettingsPropertiesEvent(args: SyncToolSettingsPropertiesEventArgs): void {
    FrontstageManager.activeToolSettingsProvider && FrontstageManager.activeToolSettingsProvider.syncToolSettingsProperties(args);
  }

  // pass on ReloadToolSettingsEvent from ToolAdmin so they are treated by UiProviders
  private static handleReloadToolSettingsEvent(): void {
    // istanbul ignore else
    if (FrontstageManager.activeToolSettingsProvider) {
      FrontstageManager.activeToolSettingsProvider.reloadPropertiesFromTool();
    }
  }

  /** Initializes the FrontstageManager */
  public static initialize() {
    if (this._initialized)
      return;

    // istanbul ignore else
    if (IModelApp && IModelApp.toolAdmin) {
      IModelApp.toolAdmin.activeToolChanged.addListener((tool: Tool, _start: StartOrResume) => {
        // make sure tool settings properties are cached before creating ToolInformation
        ToolSettingsManager.clearToolSettingsData();
        // istanbul ignore else
        if (tool instanceof InteractiveTool)
          ToolSettingsManager.initializeDataForTool(tool);

        // if the tool data is not already cached then see if there is data to cache
        FrontstageManager.ensureToolInformationIsSet(tool.toolId);
        FrontstageManager.setActiveTool(tool);
      });
      ToolSettingsManager.onSyncToolSettingsProperties.addListener(FrontstageManager.handleSyncToolSettingsPropertiesEvent);
      ToolSettingsManager.onReloadToolSettingsProperties.addListener(FrontstageManager.handleReloadToolSettingsEvent);
    }

    // istanbul ignore else
    if (IModelApp && IModelApp.viewManager) {
      IModelApp.viewManager.onSelectedViewportChanged.addListener(FrontstageManager._handleSelectedViewportChanged);
    }

    this._initialized = true;
  }

  /** Handles a Viewport change & sets the active view accordingly */
  private static _handleSelectedViewportChanged = (args: SelectedViewportChangedArgs) => {
    // istanbul ignore else
    if (args.current && FrontstageManager.activeFrontstageDef && !FrontstageManager.isLoading) {
      FrontstageManager.activeFrontstageDef.setActiveViewFromViewport(args.current);
    }
  };

  /** @internal */
  public static get isInitialized(): boolean { return FrontstageManager._initialized; }
  public static set isInitialized(v: boolean) { FrontstageManager._initialized = v; }

  /** Returns true if Frontstage is loading its controls. If false the Frontstage content and controls have been created. */
  public static get isLoading(): boolean { return FrontstageManager._isLoading; }

  /** @internal */
  public static get nineZoneSize() { return FrontstageManager._nineZoneSize; }

  public static set nineZoneSize(size) {
    FrontstageManager._nineZoneSize = size;
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

  /** Get Nine-zone State Manager. */
  public static get NineZoneManager() {
    const id = FrontstageManager.activeFrontstageId;
    let manager = FrontstageManager._nineZoneManagers.get(id);
    if (!manager) {
      manager = new NineZoneManager();
      FrontstageManager._nineZoneManagers.set(id, manager);
    }
    return manager;
  }

  /** Clears the Frontstage map.
   */
  public static clearFrontstageDefs(): void {
    FrontstageManager._frontstageDefs.clear();
  }

  private static getFrontstageKey(frontstageId: string) {
    const provider = FrontstageManager._frontstageProviders.get(frontstageId);
    let isIModelIndependent = false;
    if (provider) {
      isIModelIndependent = !!provider.frontstage.props.isIModelIndependent;
    }
    const imodelId = UiFramework.getIModelConnection()?.iModelId ?? "noImodel";
    const key = isIModelIndependent ? frontstageId : `[${imodelId}]${frontstageId}`;
    return key;
  }

  /** Add a Frontstage via a definition.
   * @param frontstageDef  Definition of the Frontstage to add
   */
  private static addFrontstageDef(frontstageDef: FrontstageDef): void {
    const key = FrontstageManager.getFrontstageKey(frontstageDef.id);
    FrontstageManager._frontstageDefs.set(key, frontstageDef);
  }

  /** @internal */
  public static clearFrontstageDefsForIModelId(iModelId: string | undefined) {
    if (!iModelId)
      return;
    const keysToRemove: string[] = [];
    FrontstageManager._frontstageDefs.forEach((_: FrontstageDef, key: string) => {
      if (key.startsWith(`[${iModelId}]`))
        keysToRemove.push(key);
    });
    keysToRemove.forEach((keyValue) => {
      FrontstageManager._frontstageDefs.delete(keyValue);
    });
  }

  /** Add a Frontstage via a [[FrontstageProvider]].
   * @param frontstageProvider  FrontstageProvider representing the Frontstage to add
   */
  public static addFrontstageProvider(frontstageProvider: FrontstageProvider): void {
    FrontstageManager._frontstageProviders.set(frontstageProvider.id, frontstageProvider);
  }

  /** Find a loaded Frontstage with a given id. If the id is not provided, the active Frontstage is returned.
   * If the FrontstageDef has not been cached by FrontstageDef then it will not be found. See async function
   * `getFrontstageDef` to get a FrontstageDef.
   * @param id  Id of the Frontstage to find
   * @returns  FrontstageDef with a given id if found, or undefined if not found.
   */
  private static findFrontstageDef(id: string): FrontstageDef | undefined {
    const key = FrontstageManager.getFrontstageKey(id);
    const frontstageDef = FrontstageManager._frontstageDefs.get(key);
    if (frontstageDef instanceof FrontstageDef)
      return frontstageDef;
    return undefined;
  }

  private static findFrontstageProvider(id?: string): FrontstageProvider | undefined {
    return id ? FrontstageManager._frontstageProviders.get(id) : undefined;
  }

  /** Find a loaded Frontstage with a given id. If the id is not provided, the active Frontstage is returned. If
   * no cached FrontstageDef is found but a FrontstageProvider is registered a FrontstageDef will be created, cached, and
   * returned.
   * @param id  Id of the Frontstage to find
   * @returns  FrontstageDef with a given id if found, or undefined if not found.
   */
  public static async getFrontstageDef(id?: string): Promise<FrontstageDef | undefined> {
    if (!id)
      return FrontstageManager.activeFrontstageDef;

    let frontstageDef = FrontstageManager.findFrontstageDef(id);
    if (frontstageDef)
      return frontstageDef;

    // istanbul ignore else
    if (id) {
      const frontstageProvider = FrontstageManager.findFrontstageProvider(id);
      if (frontstageProvider) {
        frontstageDef = await FrontstageDef.create(frontstageProvider);
        // istanbul ignore else
        if (frontstageDef) {
          const key = FrontstageManager.getFrontstageKey(frontstageDef.id);
          FrontstageManager._frontstageDefs.set(key, frontstageDef);
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
    return FrontstageManager._activeFrontstageDef;
  }

  /** Gets the Id of the active FrontstageDef. If a Frontstage is not active, blank is returned.
   * @return  Id of the active FrontstageDef, or blank if one is not active.
   */
  public static get activeFrontstageId(): string {
    const activeFrontstage = FrontstageManager._activeFrontstageDef;
    return (activeFrontstage) ? activeFrontstage.id : "";
  }

  public static hasFrontstage(frontstageId: string) {
    if (FrontstageManager.findFrontstageDef(frontstageId))
      return true;
    if (FrontstageManager.findFrontstageProvider(frontstageId))
      return true;
    return false;
  }

  /** Sets the active FrontstageDef give the stageId.
   * @param  frontstageId  Id of the Frontstage to set active.
   * @returns A Promise that is fulfilled when the [[Frontstage]] is ready.
   */
  public static async setActiveFrontstage(frontstageId: string): Promise<void> {
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageId);
    if (!frontstageDef) {
      Logger.logError(UiFramework.loggerCategory(this), `setActiveFrontstage: Could not load a FrontstageDef with id of '${frontstageId}'`);
      return;
    }

    return FrontstageManager.setActiveFrontstageDef(frontstageDef);
  }

  /** Sets the active FrontstageDef.
   * @param  frontstageDef  FrontstageDef to set active.
   * @returns A Promise that is fulfilled when the [[FrontstageDef]] is ready.
   */
  public static async setActiveFrontstageDef(frontstageDef: FrontstageDef | undefined): Promise<void> {
    if (FrontstageManager._activeFrontstageDef === frontstageDef)
      return;

    FrontstageManager._isLoading = true;

    const deactivatedFrontstageDef = FrontstageManager._activeFrontstageDef;
    if (deactivatedFrontstageDef) {
      await deactivatedFrontstageDef.onDeactivated();

      const timeTracker = deactivatedFrontstageDef.timeTracker;
      FrontstageManager.onFrontstageDeactivatedEvent.emit({
        deactivatedFrontstageDef,
        activatedFrontstageDef: frontstageDef,
        totalTime: timeTracker.getTotalTimeSeconds(),
        engagementTime: timeTracker.getEngagementTimeSeconds(),
        idleTime: timeTracker.getIdleTimeSeconds(),
      });
    }

    FrontstageManager._activeFrontstageDef = frontstageDef;

    if (frontstageDef) {
      await frontstageDef.onActivated();

      FrontstageManager.onFrontstageActivatedEvent.emit({ activatedFrontstageDef: frontstageDef, deactivatedFrontstageDef });

      await frontstageDef.waitUntilReady();
      FrontstageManager._isLoading = false;
      frontstageDef.onFrontstageReady();
      FrontstageManager.onFrontstageReadyEvent.emit({ frontstageDef });
      UiShowHideManager.handleFrontstageReady();

      frontstageDef.startDefaultTool();

      await frontstageDef.setActiveContent();
    }

    FrontstageManager._isLoading = false;
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
    return FrontstageManager._activeToolId;
  }

  /** Sets the active tool id */
  public static setActiveToolId(toolId: string): void {
    FrontstageManager._activeToolId = toolId;
    const toolSettingsProvider = FrontstageManager.activeToolSettingsProvider;
    // ensure the toolSettingsProvider is initialized before emitting onToolActivatedEvent
    if (toolSettingsProvider)
      toolSettingsProvider.initialize();
    FrontstageManager.onToolActivatedEvent.emit({ toolId });
  }

  /** Sets the active tool */
  public static setActiveTool(tool: Tool): void {
    FrontstageManager.setActiveToolId(tool.toolId);
    FrontstageManager.onToolIconChangedEvent.emit({ iconSpec: tool.iconSpec });
  }

  /** Gets the active tool's [[ToolInformation]] */
  public static get activeToolInformation(): ToolInformation | undefined {
    return FrontstageManager._toolInformationMap.get(FrontstageManager.activeToolId);
  }

  /** Gets the Tool Setting React node of the active tool.
   * @return  Tool Setting React node of the active tool, or undefined if there is no active tool or Tool Settings for the active tool.
   * @internal
   */
  public static get activeToolSettingsProvider(): ToolUiProvider | undefined {
    const activeToolInformation = FrontstageManager.activeToolInformation;
    return (activeToolInformation) ? activeToolInformation.toolUiProvider : /* istanbul ignore next */ undefined;
  }

  /** Sets the active layout, content group and active content.
   * @param contentLayoutDef  Content layout to make active
   * @param contentGroup  Content Group to make active
   */
  public static async setActiveLayout(contentLayoutDef: ContentLayoutDef, contentGroup: ContentGroup): Promise<void> {
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
    // istanbul ignore else
    if (activeFrontstageDef) {
      FrontstageManager._isLoading = false;

      activeFrontstageDef.setContentLayoutAndGroup(contentLayoutDef, contentGroup);
      FrontstageManager.onContentLayoutActivatedEvent.emit({ contentLayout: contentLayoutDef, contentGroup });

      await activeFrontstageDef.waitUntilReady();
      FrontstageManager._isLoading = false;

      await activeFrontstageDef.setActiveContent();
    }
  }

  /** Sets the active layout, content group and active content.
   * @param contentGroup  Content Group to make active
   */
  public static async setActiveContentGroup(contentGroup: ContentGroup): Promise<void> {
    const contentLayoutDef = ContentLayoutManager.getLayoutForGroup(contentGroup);
    if (contentLayoutDef) {
      await FrontstageManager.setActiveLayout(contentLayoutDef, contentGroup);
    }
  }

  /** Opens a modal Frontstage. Modal Frontstages can be stacked.
   * @param modalFrontstage  Information about the modal Frontstage
   */
  public static openModalFrontstage(modalFrontstage: ModalFrontstageInfo): void {
    FrontstageManager.pushModalFrontstage(modalFrontstage);
  }

  private static pushModalFrontstage(modalFrontstage: ModalFrontstageInfo): void {
    const timeTracker = new TimeTracker();
    timeTracker.startTiming();
    const frontstageItem: ModalFrontstageItem = { modalFrontstage, timeTracker };
    FrontstageManager._modalFrontstages.push(frontstageItem);
    FrontstageManager.emitModalFrontstageChangedEvent();
  }

  /** Closes the top-most modal Frontstage.
   */
  public static closeModalFrontstage(): void {
    // istanbul ignore else
    if (FrontstageManager._modalFrontstages.length > 0) {
      const topMostStageItem = FrontstageManager._modalFrontstages[FrontstageManager._modalFrontstages.length - 1];
      if (topMostStageItem.modalFrontstage.notifyCloseRequest)
        FrontstageManager.onCloseModalFrontstageRequestedEvent.emit(
          {
            modalFrontstage: topMostStageItem.modalFrontstage,
            stageCloseFunc: FrontstageManager.popModalFrontstage,
          });
      else
        FrontstageManager.popModalFrontstage();
    }
  }

  private static popModalFrontstage(): void {
    const frontstageItem = FrontstageManager._modalFrontstages.pop();
    // istanbul ignore else
    if (frontstageItem) {
      const modalFrontstage = frontstageItem.modalFrontstage;
      const timeTracker = frontstageItem.timeTracker;
      timeTracker.stopTiming();
      FrontstageManager.onModalFrontstageClosedEvent.emit({
        modalFrontstage,
        totalTime: timeTracker.getTotalTimeSeconds(),
        engagementTime: timeTracker.getEngagementTimeSeconds(),
        idleTime: timeTracker.getIdleTimeSeconds(),
      });
    }

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
    if (FrontstageManager._modalFrontstages.length > 0) {
      const frontstageItem = FrontstageManager._modalFrontstages[FrontstageManager._modalFrontstages.length - 1];
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

  /** Finds a widget with the given id in the active frontstage
   * @param widgetId  Id of the Widget to find
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
