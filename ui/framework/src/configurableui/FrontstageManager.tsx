/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import { UiEvent } from "@bentley/ui-core";

import { FrontstageDef, FrontstageProps } from "./FrontstageDef";
import { ToolItemDef } from "./Item";
import { ContentControl } from "./ContentControl";
import { ContentLayoutDef } from "./ContentLayout";
import { ContentGroup } from "./ContentGroup";
import { WidgetDef, WidgetState } from "./WidgetDef";

import NineZoneStateManagement from "@bentley/ui-ninezone/lib/zones/state/Management";

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

/** Modal Frontstage Stack Changed Event Args class.
 */
export interface ModalFrontstageStackChangedEventArgs {
  modalFrontstageStackDepth: number;
}

/** Modal Frontstage Stack Changed Event class.
 */
export class ModalFrontstageStackChangedEvent extends UiEvent<ModalFrontstageStackChangedEventArgs> { }

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
  contentControl?: ContentControl;
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
  private static _activeFrontstageDef: FrontstageDef;
  private static _modalFrontstages: ModalFrontstageInfo[] = new Array<ModalFrontstageInfo>();
  private static _frontstageDefs = new Map<string, FrontstageDef>();

  private static _frontstageActivatedEvent: FrontstageActivatedEvent = new FrontstageActivatedEvent();
  private static _modalFrontstageStackChangedEvent: ModalFrontstageStackChangedEvent = new ModalFrontstageStackChangedEvent();
  private static _toolActivatedEvent: ToolActivatedEvent = new ToolActivatedEvent();
  private static _contentLayoutActivatedEvent: ContentLayoutActivatedEvent = new ContentLayoutActivatedEvent();
  private static _contentControlActivatedEvent: ContentControlActivatedEvent = new ContentControlActivatedEvent();
  private static _navigationAidActivatedEvent: NavigationAidActivatedEvent = new NavigationAidActivatedEvent();
  private static _widgetStateChangedEvent: WidgetStateChangedEvent = new WidgetStateChangedEvent();

  private static _nineZoneStateManagement: NineZoneStateManagement = new NineZoneStateManagement();

  public static get FrontstageActivatedEvent(): FrontstageActivatedEvent { return this._frontstageActivatedEvent; }

  public static get ModalFrontstageStackChangedEvent(): ModalFrontstageStackChangedEvent { return this._modalFrontstageStackChangedEvent; }

  public static get ToolActivatedEvent(): ToolActivatedEvent { return this._toolActivatedEvent; }

  public static get ContentLayoutActivatedEvent(): ContentLayoutActivatedEvent { return this._contentLayoutActivatedEvent; }

  public static get ContentControlActivatedEvent(): ContentControlActivatedEvent { return this._contentControlActivatedEvent; }

  public static get NavigationAidActivatedEvent(): NavigationAidActivatedEvent { return this._navigationAidActivatedEvent; }

  public static get WidgetStateChangedEvent(): WidgetStateChangedEvent { return this._widgetStateChangedEvent; }

  public static get NineZoneStateManagement(): NineZoneStateManagement { return this._nineZoneStateManagement; }

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

  public static get activeFrontstageDef(): FrontstageDef {
    return this._activeFrontstageDef;
  }

  public static get activeFrontstageId(): string {
    const activeFrontstage = this._activeFrontstageDef;
    return (activeFrontstage) ? activeFrontstage.id : "";
  }

  // TODO - connect to Redux
  public static setActiveFrontstageDef(frontstageDef: FrontstageDef | undefined): void {
    if (frontstageDef) {
      this._activeFrontstageDef = frontstageDef;
      frontstageDef.onActivated();
      this.FrontstageActivatedEvent.emit({ frontstageId: frontstageDef.id, frontstageDef });
    }
  }

  public static get activeToolId(): string {
    const activeFrontstage = this._activeFrontstageDef;
    return (activeFrontstage) ? activeFrontstage.activeToolId : "";
  }

  public static get activeToolSettingsNode(): React.ReactNode | undefined {
    const activeToolItem = this.activeFrontstageDef.activeToolItem;
    const toolUiProvider = (activeToolItem) ? activeToolItem.toolUiProvider : undefined;

    if (toolUiProvider && toolUiProvider.toolSettingsNode)
      return toolUiProvider.toolSettingsNode;

    return undefined;
  }

  public static get activeToolAssistanceNode(): React.ReactNode | undefined {
    const activeToolItem = this.activeFrontstageDef.activeToolItem;
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
    this.emitModalFrontstageStackChangedEvent();
  }

  public static closeModalFrontstage(): void {
    this.popModalFrontstage();
  }

  private static popModalFrontstage(): void {
    this._modalFrontstages.pop();
    this.emitModalFrontstageStackChangedEvent();
  }

  private static emitModalFrontstageStackChangedEvent(): void {
    this.ModalFrontstageStackChangedEvent.emit({ modalFrontstageStackDepth: this.modalFrontstageStackDepth });
  }

  public static updateModalFrontstage(): void {
    this.emitModalFrontstageStackChangedEvent();
  }

  public static get activeModalFrontstage(): ModalFrontstageInfo | undefined {
    if (this._modalFrontstages.length > 0)
      return this._modalFrontstages[this._modalFrontstages.length - 1];

    return undefined;
  }

  public static get modalFrontstageStackDepth(): number {
    return this._modalFrontstages.length;
  }

  public static setActiveNavigationAid(navigationAidId: string) {
    this.NavigationAidActivatedEvent.emit({ navigationAidId });
  }
}
