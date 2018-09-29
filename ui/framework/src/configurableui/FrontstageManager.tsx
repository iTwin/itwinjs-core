/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import { UiEvent } from "@bentley/ui-core";

import { FrontstageDef, FrontstageProps } from "./FrontstageDef";
import { ToolItemDef } from "./Item";
import { ContentControl } from "./ContentControl";
import { ContentLayoutDef } from "./ContentLayout";
import { ContentGroup } from "./ContentGroup";
import { WidgetDef, WidgetState } from "./WidgetDef";

import NineZoneStateManager from "@bentley/ui-ninezone/lib/zones/state/Manager";

// -----------------------------------------------------------------------------
// Frontstage Events
// -----------------------------------------------------------------------------

/** Frontstage Activated Event Args class.
 */
export interface FrontstageActivatedEventArgs {
  frontstageId: string;
  frontstageDef: FrontstageDef;
}

/** Frontstage Activated Event class.
 */
export class FrontstageActivatedEvent extends UiEvent<FrontstageActivatedEventArgs> { }

/** Modal Frontstage Changed Event Args class.
 */
export interface ModalFrontstageChangedEventArgs {
  modalFrontstageCount: number;
}

/** Modal Frontstage Stack Changed Event class.
 */
export class ModalFrontstageChangedEvent extends UiEvent<ModalFrontstageChangedEventArgs> { }

/** Tool Activated Event Args class.
 */
export interface ToolActivatedEventArgs {
  toolId: string;
  toolItem?: ToolItemDef;
}

/** Tool Activated Event class.
 */
export class ToolActivatedEvent extends UiEvent<ToolActivatedEventArgs> { }

/** Layout Activated Event Args class.
 */
export interface ContentLayoutActivatedEventArgs {
  contentLayout: ContentLayoutDef;
  contentGroup: ContentGroup;
}

/** Layout Activated Event class.
 */
export class ContentLayoutActivatedEvent extends UiEvent<ContentLayoutActivatedEventArgs> { }

/** ControlControl Activated Event Args class.
 */
export interface ContentControlActivatedEventArgs {
  activeContentControl: ContentControl;
  oldContentControl?: ContentControl;
}

/** ContentControl Activated Event class.
 */
export class ContentControlActivatedEvent extends UiEvent<ContentControlActivatedEventArgs> { }

/** NavigationAid Activated Event Args class.
 */
export interface NavigationAidActivatedEventArgs {
  navigationAidId: string;
}

/** NavigationAid Activated Event class.
 */
export class NavigationAidActivatedEvent extends UiEvent<NavigationAidActivatedEventArgs> { }

/** Widget State Changed Event Args class.
 */
export interface WidgetStateChangedEventArgs {
  widgetDef: WidgetDef;
  widgetState: WidgetState;
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
  private static _activeFrontstageDef: FrontstageDef | undefined;
  private static _modalFrontstages: ModalFrontstageInfo[] = new Array<ModalFrontstageInfo>();
  private static _frontstageDefs = new Map<string, FrontstageDef>();

  private static _frontstageActivatedEvent: FrontstageActivatedEvent = new FrontstageActivatedEvent();
  private static _modalFrontstageChangedEvent: ModalFrontstageChangedEvent = new ModalFrontstageChangedEvent();
  private static _toolActivatedEvent: ToolActivatedEvent = new ToolActivatedEvent();
  private static _contentLayoutActivatedEvent: ContentLayoutActivatedEvent = new ContentLayoutActivatedEvent();
  private static _contentControlActivatedEvent: ContentControlActivatedEvent = new ContentControlActivatedEvent();
  private static _navigationAidActivatedEvent: NavigationAidActivatedEvent = new NavigationAidActivatedEvent();
  private static _widgetStateChangedEvent: WidgetStateChangedEvent = new WidgetStateChangedEvent();

  public static get onFrontstageActivatedEvent(): FrontstageActivatedEvent { return this._frontstageActivatedEvent; }

  public static get onModalFrontstageChangedEvent(): ModalFrontstageChangedEvent { return this._modalFrontstageChangedEvent; }

  public static get onToolActivatedEvent(): ToolActivatedEvent { return this._toolActivatedEvent; }

  public static get onContentLayoutActivatedEvent(): ContentLayoutActivatedEvent { return this._contentLayoutActivatedEvent; }

  public static get onContentControlActivatedEvent(): ContentControlActivatedEvent { return this._contentControlActivatedEvent; }

  public static get onNavigationAidActivatedEvent(): NavigationAidActivatedEvent { return this._navigationAidActivatedEvent; }

  public static get onWidgetStateChangedEvent(): WidgetStateChangedEvent { return this._widgetStateChangedEvent; }

  public static get NineZoneStateManager() { return NineZoneStateManager; }

  public static loadFrontstages(frontstagePropsList: FrontstageProps[]) {
    frontstagePropsList.map((frontstageProps, _index) => {
      FrontstageManager.loadFrontstage(frontstageProps);
    });
  }

  public static loadFrontstage(frontstageProps: FrontstageProps) {
    const frontstageDef = new FrontstageDef(frontstageProps);
    if (frontstageDef) {
      FrontstageManager.addFrontstageDef(frontstageDef);
    }
  }

  public static addFrontstageDef(frontstageDef: FrontstageDef): void {
    this._frontstageDefs.set(frontstageDef.id, frontstageDef);
  }

  public static findFrontstageDef(id?: string): FrontstageDef | undefined {
    if (!id)
      return this.activeFrontstageDef;
    const frontstageDef = this._frontstageDefs.get(id);
    if (frontstageDef instanceof FrontstageDef)
      return frontstageDef;
    return undefined;
  }

  /** Gets the active FrontstageDef. If a Frontstage is not active, undefined is returned. */
  public static get activeFrontstageDef(): FrontstageDef | undefined {
    return this._activeFrontstageDef;
  }

  public static get activeFrontstageId(): string {
    const activeFrontstage = this._activeFrontstageDef;
    return (activeFrontstage) ? activeFrontstage.id : "";
  }

  // TODO - connect to Redux
  public static setActiveFrontstageDef(frontstageDef: FrontstageDef | undefined): void {
    this._activeFrontstageDef = frontstageDef;
    if (frontstageDef) {
      frontstageDef.onActivated();
      this.onFrontstageActivatedEvent.emit({ frontstageId: frontstageDef.id, frontstageDef });
    }
  }

  public static get activeToolId(): string {
    const activeFrontstage = this._activeFrontstageDef;
    return (activeFrontstage) ? activeFrontstage.activeToolId : "";
  }

  public static get activeToolSettingsNode(): React.ReactNode | undefined {
    const activeToolItem = this.activeFrontstageDef ? this.activeFrontstageDef.activeToolItem : undefined;
    const toolUiProvider = (activeToolItem) ? activeToolItem.toolUiProvider : undefined;

    if (toolUiProvider && toolUiProvider.toolSettingsNode)
      return toolUiProvider.toolSettingsNode;

    return undefined;
  }

  public static get activeToolAssistanceNode(): React.ReactNode | undefined {
    const activeToolItem = this.activeFrontstageDef ? this.activeFrontstageDef.activeToolItem : undefined;
    const toolUiProvider = (activeToolItem) ? activeToolItem.toolUiProvider : undefined;

    if (toolUiProvider && toolUiProvider.toolAssistanceNode)
      return toolUiProvider.toolAssistanceNode;

    return undefined;
  }

  public static openModalFrontstage(modalFrontstage: ModalFrontstageInfo): void {
    this.pushModalFrontstage(modalFrontstage);
  }

  private static pushModalFrontstage(modalFrontstage: ModalFrontstageInfo): void {
    this._modalFrontstages.push(modalFrontstage);
    this.emitModalFrontstageChangedEvent();
  }

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

  public static updateModalFrontstage(): void {
    this.emitModalFrontstageChangedEvent();
  }

  public static get activeModalFrontstage(): ModalFrontstageInfo | undefined {
    if (this._modalFrontstages.length > 0)
      return this._modalFrontstages[this._modalFrontstages.length - 1];

    return undefined;
  }

  public static get modalFrontstageCount(): number {
    return this._modalFrontstages.length;
  }

  public static setActiveNavigationAid(navigationAidId: string) {
    this.onNavigationAidActivatedEvent.emit({ navigationAidId });
  }
}
