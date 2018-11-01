/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import { UiEvent } from "@bentley/ui-core";

import { FrontstageDef, FrontstageDefProps } from "./FrontstageDef";
import { ContentControl } from "./ContentControl";
import { ContentLayoutDef } from "./ContentLayout";
import { ContentGroup } from "./ContentGroup";
import { WidgetDef, WidgetState } from "./WidgetDef";
import { ContentViewManager } from "./ContentViewManager";

import NineZoneStateManager from "@bentley/ui-ninezone/lib/zones/state/Manager";
import { IModelConnection, IModelApp, Tool, StartOrResume } from "@bentley/imodeljs-frontend";
import { ToolInformation } from "./ToolInformation";
import { FrontstageProvider } from "./Frontstage";

// -----------------------------------------------------------------------------
// Frontstage Events
// -----------------------------------------------------------------------------

/** Frontstage Activated Event Args interface.
 */
export interface FrontstageActivatedEventArgs {
  frontstageId: string;
  frontstageDef?: FrontstageDef;
}

/** Frontstage Activated Event class.
 */
export class FrontstageActivatedEvent extends UiEvent<FrontstageActivatedEventArgs> { }

/** Frontstage Ready Event Args interface.
 */
export interface FrontstageReadyEventArgs {
  frontstageId: string;
  frontstageDef?: FrontstageDef;
}

/** Frontstage Ready Event class.
 */
export class FrontstageReadyEvent extends UiEvent<FrontstageReadyEventArgs> { }

/** Modal Frontstage Changed Event Args interface.
 */
export interface ModalFrontstageChangedEventArgs {
  modalFrontstageCount: number;
}

/** Modal Frontstage Stack Changed Event class.
 */
export class ModalFrontstageChangedEvent extends UiEvent<ModalFrontstageChangedEventArgs> { }

/** Tool Activated Event Args interface.
 */
export interface ToolActivatedEventArgs {
  toolId: string;
}

/** Tool Activated Event class.
 */
export class ToolActivatedEvent extends UiEvent<ToolActivatedEventArgs> { }

/** Content Layout Activated Event Args class.
 */
export interface ContentLayoutActivatedEventArgs {
  contentLayout: ContentLayoutDef;
  contentGroup: ContentGroup;
}

/** Content Layout Activated Event class.
 */
export class ContentLayoutActivatedEvent extends UiEvent<ContentLayoutActivatedEventArgs> { }

/** ControlControl Activated Event Args interface.
 */
export interface ContentControlActivatedEventArgs {
  activeContentControl: ContentControl;
  oldContentControl?: ContentControl;
}

/** ContentControl Activated Event class.
 */
export class ContentControlActivatedEvent extends UiEvent<ContentControlActivatedEventArgs> { }

/** NavigationAid Activated Event Args interface.
 */
export interface NavigationAidActivatedEventArgs {
  navigationAidId: string;
  iModelConnection: IModelConnection;
}

/** NavigationAid Activated Event class.
 */
export class NavigationAidActivatedEvent extends UiEvent<NavigationAidActivatedEventArgs> { }

/** Widget State Changed Event Args interface.
 */
export interface WidgetStateChangedEventArgs {
  widgetDef: WidgetDef;
  oldWidgetState: WidgetState;
  newWidgetState: WidgetState;
}

/** Widget State Changed Event class.
 */
export class WidgetStateChangedEvent extends UiEvent<WidgetStateChangedEventArgs> { }

/** Modal Frontstage information interface.
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
 */
export class FrontstageManager {
  private static _isLoading = true;

  private static _activeFrontstageDef: FrontstageDef | undefined;
  private static _modalFrontstages: ModalFrontstageInfo[] = new Array<ModalFrontstageInfo>();
  private static _frontstageDefs = new Map<string, FrontstageDef>();

  private static _activeToolId: string = "";
  private static _toolInformationMap: Map<string, ToolInformation> = new Map<string, ToolInformation>();

  private static _frontstageActivatedEvent: FrontstageActivatedEvent = new FrontstageActivatedEvent();
  private static _frontstageReadyEvent: FrontstageReadyEvent = new FrontstageReadyEvent();
  private static _modalFrontstageChangedEvent: ModalFrontstageChangedEvent = new ModalFrontstageChangedEvent();
  private static _toolActivatedEvent: ToolActivatedEvent = new ToolActivatedEvent();
  private static _contentLayoutActivatedEvent: ContentLayoutActivatedEvent = new ContentLayoutActivatedEvent();
  private static _contentControlActivatedEvent: ContentControlActivatedEvent = new ContentControlActivatedEvent();
  private static _navigationAidActivatedEvent: NavigationAidActivatedEvent = new NavigationAidActivatedEvent();
  private static _widgetStateChangedEvent: WidgetStateChangedEvent = new WidgetStateChangedEvent();

  /** Initializes the FrontstageManager */
  public static initialize() {

    if (IModelApp && IModelApp.toolAdmin) {
      IModelApp.toolAdmin.activeToolChanged.addListener((tool: Tool, _start: StartOrResume) => {
        FrontstageManager.setActiveToolId(tool.toolId);
      });
    }
  }

  /** Returns true if Frontstage is loading its controls. If false the Frontstage content and controls have been created. */
  public static get isLoading(): boolean { return this._isLoading; }

  /** Get Frontstage Activated event. */
  public static get onFrontstageActivatedEvent(): FrontstageActivatedEvent { return this._frontstageActivatedEvent; }

  /** Get Frontstage Activated event. */
  public static get onFrontstageReadyEvent(): FrontstageReadyEvent { return this._frontstageReadyEvent; }

  /** Get Modal Frontstage Changed event. */
  public static get onModalFrontstageChangedEvent(): ModalFrontstageChangedEvent { return this._modalFrontstageChangedEvent; }

  /** Get Tool Activated event. */
  public static get onToolActivatedEvent(): ToolActivatedEvent { return this._toolActivatedEvent; }

  /** Get Content Layout Activated event. */
  public static get onContentLayoutActivatedEvent(): ContentLayoutActivatedEvent { return this._contentLayoutActivatedEvent; }

  /** Get Content Control Activated event. */
  public static get onContentControlActivatedEvent(): ContentControlActivatedEvent { return this._contentControlActivatedEvent; }

  /** Get Navigation Aid Activated event. */
  public static get onNavigationAidActivatedEvent(): NavigationAidActivatedEvent { return this._navigationAidActivatedEvent; }

  /** Get Widget State Changed event. */
  public static get onWidgetStateChangedEvent(): WidgetStateChangedEvent { return this._widgetStateChangedEvent; }

  /** Get  Nine-zone State Manager. */
  public static get NineZoneStateManager() { return NineZoneStateManager; }

  /** Load one or more Frontstages via properties.
   * @param frontstagePropsList  List of Frontstage properties
   */
  public static loadFrontstages(frontstagePropsList: FrontstageDefProps[]): void {
    frontstagePropsList.map((frontstageProps, _index) => {
      FrontstageManager.loadFrontstage(frontstageProps);
    });
  }

  /** Load a Frontstage via properties.
   * @param frontstageProps  Properties of the Frontstage to load
   */
  public static loadFrontstage(frontstageProps: FrontstageDefProps): void {
    const frontstageDef = new FrontstageDef(frontstageProps);
    if (frontstageDef) {
      FrontstageManager.addFrontstageDef(frontstageDef);
    }
  }

  /** Add a Frontstage via a definition.
   * @param frontstageDef  Definition of the Frontstage to add
   */
  public static addFrontstageDef(frontstageDef: FrontstageDef): void {
    this._frontstageDefs.set(frontstageDef.id, frontstageDef);
  }

  /** Add a Frontstage via a [[FrontstageElement]].
   * @param frontstageProvider  FrontstageProvider representing the Frontstage to add
   */
  public static addFrontstageProvider(frontstageProvider: FrontstageProvider): void {
    const frontstageDef: FrontstageDef = new FrontstageDef();
    frontstageDef.initializeFromProvider(frontstageProvider);
    frontstageProvider.frontstageDef = frontstageDef;
    this.addFrontstageDef(frontstageDef);
  }

  /** Find a loaded Frontstage with a given id. If the id is not provided, the active Frontstage is returned.
   * @param id  Id of the Frontstage to find
   * @returns  FrontstageDef with a given id if found, or undefined if not found.
   */
  public static findFrontstageDef(id?: string): FrontstageDef | undefined {
    if (!id)
      return this.activeFrontstageDef;
    const frontstageDef = this._frontstageDefs.get(id);
    if (frontstageDef instanceof FrontstageDef)
      return frontstageDef;
    return undefined;
  }

  /** Gets the active FrontstageDef. If a Frontstage is not active, undefined is returned.
   * @return  Active FrontstageDef, or undefined if one is not active.
   */
  public static get activeFrontstageDef(): FrontstageDef | undefined {
    return this._activeFrontstageDef;
  }

  /** Gets the Id of the active FrontstageDef. If a Frontstage is not active, blank is returned.
   * @return  Id of the active FrontstageDef, or blank if one is not active.
   */
  public static get activeFrontstageId(): string {
    const activeFrontstage = this._activeFrontstageDef;
    return (activeFrontstage) ? activeFrontstage.id : "";
  }

  /** Sets the active FrontstageDef.
   * @param  frontstageId  Id of the Frontstage to set active.
   * @returns A Promise that is fulfilled when the [[Frontstage]] is ready.
   */
  public static async setActiveFrontstage(frontstageId: string): Promise<void> {
    const frontstageDef = FrontstageManager.findFrontstageDef(frontstageId);
    if (!frontstageDef) {
      throw Error("setActiveFrontstage: Could not find Frontstage with id of '" + frontstageId + "'");
    }

    return FrontstageManager.setActiveFrontstageDef(frontstageDef);
  }

  /** Sets the active FrontstageDef.
   * @param  frontstageDef  FrontstageDef to set active.
   * @returns A Promise that is fulfilled when the [[FrontstageDef]] is ready.
   */
  public static async setActiveFrontstageDef(frontstageDef: FrontstageDef | undefined): Promise<void> {
    this._isLoading = true;
    this._activeFrontstageDef = frontstageDef;

    if (frontstageDef) {
      frontstageDef.onActivated();
      this.onFrontstageActivatedEvent.emit({ frontstageId: frontstageDef.id, frontstageDef });
      await frontstageDef.waitUntilReady();
      this._isLoading = false;
      this.onFrontstageReadyEvent.emit({ frontstageId: frontstageDef.id, frontstageDef });
      if (frontstageDef.contentControls.length >= 0) {
        // TODO: get content control to activate from state info
        const contentControl = frontstageDef.contentControls[0];
        if (contentControl)
          ContentViewManager.setActiveContent(contentControl.reactElement, true);
      }
    }
    this._isLoading = false;
  }

  /** Gets the Id of the active tool. If a tool is not active, blank is returned.
   * @return  Id of the active tool, or blank if one is not active.
   */
  public static get activeToolId(): string {
    return this._activeToolId;
  }

  /** Sets the active tool id */
  public static setActiveToolId(toolId: string): void {
    if (this._activeToolId !== toolId) {
      this._activeToolId = toolId;

      if (!this._toolInformationMap.get(toolId))
        this._toolInformationMap.set(toolId, new ToolInformation(toolId));

      FrontstageManager.onToolActivatedEvent.emit({ toolId });
    }
  }

  /** Gets the active tool's [[ToolInformation]] */
  public static get activeToolInformation(): ToolInformation | undefined {
    return this._toolInformationMap.get(this._activeToolId);
  }

  /** Gets the Tool Setting React node of the active tool.
   * @return  Tool Setting React node of the active tool, or undefined if there is no active tool or Tool Settings for the active tool.
   */
  public static get activeToolSettingsNode(): React.ReactNode | undefined {
    const activeToolInformation = this.activeToolInformation;
    const toolUiProvider = (activeToolInformation) ? activeToolInformation.toolUiProvider : undefined;

    if (toolUiProvider && toolUiProvider.toolSettingsNode)
      return toolUiProvider.toolSettingsNode;

    return undefined;
  }

  /** Gets the Tool Assistance React node of the active tool.
   * @return  Tool Assistance React node of the active tool, or undefined if there is no active tool or Tool Assistance for the active tool.
   */
  public static get activeToolAssistanceNode(): React.ReactNode | undefined {
    const activeToolInformation = this.activeToolInformation;
    const toolUiProvider = (activeToolInformation) ? activeToolInformation.toolUiProvider : undefined;

    if (toolUiProvider && toolUiProvider.toolAssistanceNode)
      return toolUiProvider.toolAssistanceNode;

    return undefined;
  }

  /** Opens a modal Frontstage. Modal Frontstages can be stacked.
   * @param modalFrontstage  Information about the modal Frontstage
   */
  public static openModalFrontstage(modalFrontstage: ModalFrontstageInfo): void {
    this.pushModalFrontstage(modalFrontstage);
  }

  private static pushModalFrontstage(modalFrontstage: ModalFrontstageInfo): void {
    this._modalFrontstages.push(modalFrontstage);
    this.emitModalFrontstageChangedEvent();
  }

  /** Closes the top-most modal Frontstage.
   */
  public static closeModalFrontstage(): void {
    this.popModalFrontstage();
  }

  private static popModalFrontstage(): void {
    this._modalFrontstages.pop();
    this.emitModalFrontstageChangedEvent();
  }

  private static emitModalFrontstageChangedEvent(): void {
    this.onModalFrontstageChangedEvent.emit({ modalFrontstageCount: this.modalFrontstageCount });
  }

  /** Updates the top-most modal Frontstage.
   */
  public static updateModalFrontstage(): void {
    this.emitModalFrontstageChangedEvent();
  }

  /** Gets the top-most modal Frontstage.
   * @returns Top-most modal Frontstage, or undefined if there is none.
   */
  public static get activeModalFrontstage(): ModalFrontstageInfo | undefined {
    if (this._modalFrontstages.length > 0)
      return this._modalFrontstages[this._modalFrontstages.length - 1];

    return undefined;
  }

  /** Gets the number of modal Frontstages.
   * @returns Modal Frontstage count
   */
  public static get modalFrontstageCount(): number {
    return this._modalFrontstages.length;
  }

  /** Sets the active Navigation Aid via its Id.
   * @param navigationAidId  Id of the Navigation Aid to set as active
   * @param iModelConnection IModelConnection to query for view data
   */
  public static setActiveNavigationAid(navigationAidId: string, iModelConnection: IModelConnection) {
    this.onNavigationAidActivatedEvent.emit({ navigationAidId, iModelConnection });
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
      throw Error("setWidgetState: Could not find Widget with id of '" + widgetId + "'");
    }

    return false;
  }

  /** Sets the state of the widget with the given id
   * @param widgetId  Id of the Widget for which to set the state
   * @returns The WidgetDef with the given id, or undefined if not found.
   */
  public static findWidget(widgetId: string): WidgetDef | undefined {
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
    if (activeFrontstageDef) {
      return activeFrontstageDef.findWidgetDef(widgetId);
    }

    return undefined;
  }
}
