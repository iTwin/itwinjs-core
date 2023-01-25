/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { UiEvent, WidgetState } from "@itwin/appui-abstract";
import { NineZoneManager } from "@itwin/appui-layout-react";
import { IModelConnection, Tool } from "@itwin/core-frontend";
import { Size } from "@itwin/core-react";
import { ContentGroup } from "../content/ContentGroup";
import { ToolInformation } from "../zones/toolsettings/ToolInformation";
import { ToolUiProvider } from "../zones/toolsettings/ToolUiProvider";
import { TimeTracker } from "../configurableui/TimeTracker";
import { ContentControlActivatedEvent } from "../content/ContentControl";
import { ContentLayoutActivatedEvent, ContentLayoutDef } from "../content/ContentLayout";
import { FrontstageDef, FrontstageEventArgs, FrontstageNineZoneStateChangedEventArgs } from "../frontstage/FrontstageDef";
import { FrontstageProvider } from "../frontstage/FrontstageProvider";
import { NavigationAidActivatedEvent } from "../navigationaids/NavigationAidControl";
import { PanelSizeChangedEvent, PanelStateChangedEvent } from "../stagepanels/StagePanelDef";
import { WidgetChangedEventArgs, WidgetDef, WidgetEventArgs, WidgetStateChangedEvent } from "../widgets/WidgetDef";

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
export interface ModalFrontstageItem {
  modalFrontstage: ModalFrontstageInfo;
  timeTracker: TimeTracker;
}

/**
 * [[UiFramework.frontstages]] interface
 * @beta
 */
export interface FrameworkFrontstages {
  /** This should only be called within InternalFrontstageManager and its tests.
   *  @internal
   */
  ensureToolInformationIsSet(toolId: string): void;

  /** Initializes the InternalFrontstageManager
   * @internal
  */
  initialize(): void;

  /** @internal */
  isInitialized: boolean;

  /** Returns true if Frontstage is loading its controls. If false the Frontstage content and controls have been created. */
  readonly isLoading: boolean;

  /** @internal */
  nineZoneSize: Size | undefined;

  /** @internal */
  readonly frontstageDefs: ReadonlyMap<string, FrontstageDef>;

  /** Get Frontstage Deactivated event. */
  readonly onFrontstageDeactivatedEvent: FrontstageDeactivatedEvent;

  /** Get Frontstage Activated event. */
  readonly onFrontstageActivatedEvent: FrontstageActivatedEvent;

  /** Get Frontstage Activated event. */
  readonly onFrontstageReadyEvent: FrontstageReadyEvent;

  /** Get Modal Frontstage Changed event. */
  readonly onModalFrontstageChangedEvent: ModalFrontstageChangedEvent;

  /** Get Modal Frontstage Closed event. */
  readonly onModalFrontstageClosedEvent: ModalFrontstageClosedEvent;

  /** Get Modal Frontstage Requested Closed event.
   * @alpha
   */
  readonly onCloseModalFrontstageRequestedEvent: ModalFrontstageRequestedCloseEvent;

  /** Get Tool Activated event. */
  readonly onToolActivatedEvent: ToolActivatedEvent;

  /** Get ToolSetting Reload event. */
  readonly onToolSettingsReloadEvent: UiEvent<void>;

  /** Get Tool Panel Opened event.
   * @internal
   */
  readonly onToolPanelOpenedEvent: UiEvent<void>;

  /** Get Tool Icon Changed event. */
  readonly onToolIconChangedEvent: ToolIconChangedEvent;

  /** Get Content Layout Activated event. */
  readonly onContentLayoutActivatedEvent: ContentLayoutActivatedEvent;

  /** Get Content Control Activated event. */
  readonly onContentControlActivatedEvent: ContentControlActivatedEvent;

  /** Get Navigation Aid Activated event. */
  readonly onNavigationAidActivatedEvent: NavigationAidActivatedEvent;

  /** Get Widget State Changed event. */
  readonly onWidgetStateChangedEvent: WidgetStateChangedEvent;

  /** @internal */
  readonly onWidgetLabelChangedEvent: UiEvent<WidgetChangedEventArgs>;

  /** @internal */
  readonly onWidgetShowEvent: UiEvent<WidgetEventArgs>;

  /** @internal */
  readonly onWidgetExpandEvent: UiEvent<WidgetEventArgs>;

  /** @internal */
  readonly onWidgetDefsUpdatedEvent: UiEvent<void>;

  /** @internal */
  readonly onFrontstageNineZoneStateChangedEvent: UiEvent<FrontstageNineZoneStateChangedEventArgs>;

  /** @internal */
  readonly onFrontstageRestoreLayoutEvent: UiEvent<FrontstageEventArgs>;

  /** Get Widget State Changed event.
   * @alpha
   */
  readonly onPanelStateChangedEvent: PanelStateChangedEvent;

  /** @internal */
  readonly onPanelSizeChangedEvent: PanelSizeChangedEvent;

  /** Get Nine-zone State Manager.
   * @deprecated Used in UI1.0 only.
   */
  readonly NineZoneManager: NineZoneManager;

  /** Clears the Frontstage map.
   */
  clearFrontstageDefs(): void;

  /** Clears the Frontstage Providers and the defs that may have been created from them.
   */
  clearFrontstageProviders(): void;

  /** @internal */
  clearFrontstageDefsForIModelId(iModelId: string | undefined): void;

  /** Add a Frontstage via a [[FrontstageProvider]].
   * @param frontstageProvider  FrontstageProvider representing the Frontstage to add
   */
  addFrontstageProvider(frontstageProvider: FrontstageProvider): void;

  /** Find a loaded Frontstage with a given id. If the id is not provided, the active Frontstage is returned. If
   * no cached FrontstageDef is found but a FrontstageProvider is registered a FrontstageDef will be created, cached, and
   * returned.
   * @param id  Id of the Frontstage to find
   * @returns  FrontstageDef with a given id if found, or undefined if not found.
   */
  getFrontstageDef(id?: string): Promise<FrontstageDef | undefined>;

  /** Gets the active FrontstageDef. If a Frontstage is not active, undefined is returned.
   * @return  Active FrontstageDef, or undefined if one is not active.
   */
  readonly activeFrontstageDef: FrontstageDef | undefined;

  /** Gets the Id of the active FrontstageDef. If a Frontstage is not active, blank is returned.
   * @return  Id of the active FrontstageDef, or blank if one is not active.
   */
  readonly activeFrontstageId: string;

  hasFrontstage(frontstageId: string): boolean;

  /** Sets the active FrontstageDef give the stageId.
   * @param  frontstageId  Id of the Frontstage to set active.
   * @returns A Promise that is fulfilled when the [[Frontstage]] is ready.
   */
  setActiveFrontstage(frontstageId: string): Promise<void>;

  /** Sets the active FrontstageDef.
   * @param  frontstageDef  FrontstageDef to set active.
   * @returns A Promise that is fulfilled when the [[FrontstageDef]] is ready.
   */
  setActiveFrontstageDef(frontstageDef: FrontstageDef | undefined): Promise<void>;

  /** Deactivates the active FrontstageDef.
   */
  deactivateFrontstageDef(): Promise<void>;

  /** Gets the Id of the active tool. If a tool is not active, blank is returned.
   * @return  Id of the active tool, or blank if one is not active.
   */
  readonly activeToolId: string;

  /** Sets the active tool id */
  setActiveToolId(toolId: string): void;

  /** Sets the active tool */
  setActiveTool(tool: Tool): void;

  /** Gets the active tool's [[ToolInformation]] */
  readonly activeToolInformation: ToolInformation | undefined;

  /** Gets the Tool Setting React node of the active tool.
   * @return  Tool Setting React node of the active tool, or undefined if there is no active tool or Tool Settings for the active tool.
   * @internal
   */
  readonly activeToolSettingsProvider: ToolUiProvider | undefined;

  /** Sets the active layout, content group and active content.
   * @param contentLayoutDef  Content layout to make active
   * @param contentGroup  Content Group to make active
   */
  setActiveLayout(contentLayoutDef: ContentLayoutDef, contentGroup: ContentGroup): Promise<void>;

  /** Sets the active layout, content group and active content.
   * @param contentGroup  Content Group to make active
   */
  setActiveContentGroup(contentGroup: ContentGroup): Promise<void>;

  /** Opens a modal Frontstage. Modal Frontstages can be stacked.
   * @param modalFrontstage  Information about the modal Frontstage
   */
  openModalFrontstage(modalFrontstage: ModalFrontstageInfo): void;

  /** Closes the top-most modal Frontstage.
   */
  closeModalFrontstage(): void;

  /** Updates the top-most modal Frontstage.
   */
  updateModalFrontstage(): void;

  /** Gets the top-most modal Frontstage.
   * @returns Top-most modal Frontstage, or undefined if there is none.
   */
  readonly activeModalFrontstage: ModalFrontstageInfo | undefined;

  /** Gets the number of modal Frontstages.
   * @returns Modal Frontstage count
   */
  readonly modalFrontstageCount: number;

  /** Sets the active Navigation Aid via its Id.
   * @param navigationAidId  Id of the Navigation Aid to set as active
   * @param iModelConnection IModelConnection to query for view data
   */
  setActiveNavigationAid(navigationAidId: string, iModelConnection: IModelConnection): void;

  /** Sets the state of the widget with the given id
   * @param widgetId  Id of the Widget for which to set the state
   * @param state     New state of the widget
   * @returns true if the widget state was set successfully, or false if not.
   */
  setWidgetState(widgetId: string, state: WidgetState): boolean;

  /** Finds a widget with the given id in the active frontstage
   * @param widgetId  Id of the Widget to find
   * @returns The WidgetDef with the given id, or undefined if not found.
   */
  findWidget(widgetId: string): WidgetDef | undefined;

  /** Opens a nested Frontstage. Nested Frontstages can be stacked.
   * @param nestedFrontstage  Information about the nested Frontstage
   */
  openNestedFrontstage(nestedFrontstage: FrontstageDef): Promise<void>;

  /** Closes the top-most nested Frontstage.
   */
  closeNestedFrontstage(): Promise<void>;

  /** Gets the top-most nested Frontstage.
   * @returns Top-most nested Frontstage, or undefined if there is none.
   */
  readonly activeNestedFrontstage: FrontstageDef | undefined;

  /** Gets the number of nested Frontstages.
   * @returns Nested Frontstage count
   */
  readonly nestedFrontstageCount: number;
}
