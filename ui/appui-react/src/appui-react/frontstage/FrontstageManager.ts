/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Frontstage
 */

import { IModelConnection, Tool } from "@itwin/core-frontend";
import { WidgetState } from "@itwin/appui-abstract";
import { ContentGroup } from "../content/ContentGroup";
import { ContentLayoutDef } from "../content/ContentLayout";
import { WidgetDef } from "../widgets/WidgetDef";
import { ToolInformation } from "../zones/toolsettings/ToolInformation";
import { ToolUiProvider } from "../zones/toolsettings/ToolUiProvider";
import { FrontstageDef } from "./FrontstageDef";
import { FrontstageProvider } from "./FrontstageProvider";
import { ModalFrontstageInfo } from "../framework/FrameworkFrontstages";
import { InternalFrontstageManager as internal } from "./InternalFrontstageManager";

/** Frontstage Manager class.
 * @public
 * @deprecated in 3.7. Use `UiFramework.frontstages` property.
 */
export class FrontstageManager {
  /** Initializes the InternalFrontstageManager
   * @deprecated in 3.7. This is called internally.
  */
  public static initialize() {
    internal.initialize();
  }

  /** This should only be called within InternalFrontstageManager and its tests.
   *  @internal
   */
  public static ensureToolInformationIsSet(toolId: string): void {
    return internal.ensureToolInformationIsSet(toolId);
  }

  /** @internal */
  public static get isInitialized(): boolean { return internal.isInitialized; }
  public static set isInitialized(v: boolean) { internal.isInitialized = v; }

  /** Returns true if Frontstage is loading its controls. If false the Frontstage content and controls have been created. */
  public static get isLoading(): boolean { return internal.isLoading; }

  /** @internal */
  public static get nineZoneSize() { return internal.nineZoneSize; }

  public static set nineZoneSize(size) {
    internal.nineZoneSize = size;
  }

  /** @internal */
  public static get frontstageDefs(): ReadonlyMap<string, FrontstageDef> {
    return internal.frontstageDefs;
  }

  /** Get Frontstage Deactivated event. */
  public static get onFrontstageDeactivatedEvent() { return internal.onFrontstageDeactivatedEvent; }

  /** Get Frontstage Activated event. */
  public static get onFrontstageActivatedEvent() { return internal.onFrontstageActivatedEvent; }

  /** Get Frontstage Activated event. */
  public static get onFrontstageReadyEvent() { return internal.onFrontstageReadyEvent; }

  /** Get Modal Frontstage Changed event. */
  public static get onModalFrontstageChangedEvent() { return internal.onModalFrontstageChangedEvent; }

  /** Get Modal Frontstage Closed event. */
  public static get onModalFrontstageClosedEvent() { return internal.onModalFrontstageClosedEvent; }

  /** Get Modal Frontstage Requested Closed event.
     * @alpha
     */
  public static get onCloseModalFrontstageRequestedEvent() { return internal.onCloseModalFrontstageRequestedEvent; }

  /** Get Tool Activated event. */
  public static get onToolActivatedEvent() { return internal.onToolActivatedEvent; }

  /** Get ToolSetting Reload event. */
  public static get onToolSettingsReloadEvent() { return internal.onToolSettingsReloadEvent; }

  /** Get Tool Panel Opened event.
     * @internal
     */
  public static get onToolPanelOpenedEvent() { return internal.onToolPanelOpenedEvent; }

  /** Get Tool Icon Changed event. */
  public static get onToolIconChangedEvent() { return internal.onToolIconChangedEvent; }

  /** Get Content Layout Activated event. */
  public static get onContentLayoutActivatedEvent() { return internal.onContentLayoutActivatedEvent; }

  /** Get Content Control Activated event. */
  public static get onContentControlActivatedEvent() { return internal.onContentControlActivatedEvent; }

  /** Get Navigation Aid Activated event. */
  public static get onNavigationAidActivatedEvent() { return internal.onNavigationAidActivatedEvent; }

  /** Get Widget State Changed event. */
  public static get onWidgetStateChangedEvent() { return internal.onWidgetStateChangedEvent; }

  /** @internal */
  public static get onWidgetLabelChangedEvent() { return internal.onWidgetLabelChangedEvent; }

  /** @internal */
  public static get onWidgetShowEvent() { return internal.onWidgetShowEvent; }

  /** @internal */
  public static get onWidgetExpandEvent() { return internal.onWidgetExpandEvent; }

  /** @internal */
  public static get onWidgetDefsUpdatedEvent() { return internal.onWidgetDefsUpdatedEvent; }

  /** @internal */
  public static get onFrontstageNineZoneStateChangedEvent() { return internal.onFrontstageNineZoneStateChangedEvent; }

  /** @internal */
  public static get onFrontstageRestoreLayoutEvent() { return internal.onFrontstageRestoreLayoutEvent; }

  /** Get Widget State Changed event.
     * @alpha
     */
  public static get onPanelStateChangedEvent() { return internal.onPanelStateChangedEvent; }

  /** @internal */
  public static get onPanelSizeChangedEvent() { return internal.onPanelSizeChangedEvent; }

  /** Get Nine-zone State Manager.
     * @deprecated in 3.6. Used in UI1.0 only.
     */
  public static get NineZoneManager() { return internal.NineZoneManager; }

  /** Clears the Frontstage map.
     */
  public static clearFrontstageDefs(): void {
    return internal.clearFrontstageDefs();
  }

  /** Clears the Frontstage Providers and the defs that may have been created from them.
     */
  public static clearFrontstageProviders(): void {
    return internal.clearFrontstageProviders();
  }

  /** @internal */
  public static clearFrontstageDefsForIModelId(iModelId: string | undefined) {
    return internal.clearFrontstageDefsForIModelId(iModelId);
  }

  /** Add a Frontstage via a [[FrontstageProvider]].
     * @param frontstageProvider  FrontstageProvider representing the Frontstage to add
     */
  public static addFrontstageProvider(frontstageProvider: FrontstageProvider): void {
    return internal.addFrontstageProvider(frontstageProvider);
  }

  /** Find a loaded Frontstage with a given id. If the id is not provided, the active Frontstage is returned. If
     * no cached FrontstageDef is found but a FrontstageProvider is registered a FrontstageDef will be created, cached, and
     * returned.
     * @param id  Id of the Frontstage to find
     * @returns  FrontstageDef with a given id if found, or undefined if not found.
     */
  public static async getFrontstageDef(id?: string): Promise<FrontstageDef | undefined> {
    return internal.getFrontstageDef(id);
  }

  /** Gets the active FrontstageDef. If a Frontstage is not active, undefined is returned.
     * @return  Active FrontstageDef, or undefined if one is not active.
     */
  public static get activeFrontstageDef(): FrontstageDef | undefined {
    return internal.activeFrontstageDef;
  }

  /** Gets the Id of the active FrontstageDef. If a Frontstage is not active, blank is returned.
     * @return  Id of the active FrontstageDef, or blank if one is not active.
     */
  public static get activeFrontstageId(): string {
    return internal.activeFrontstageId;
  }

  public static hasFrontstage(frontstageId: string) {
    return internal.hasFrontstage(frontstageId);
  }

  /** Sets the active FrontstageDef give the stageId.
     * @param  frontstageId  Id of the Frontstage to set active.
     * @returns A Promise that is fulfilled when the [[Frontstage]] is ready.
     */
  public static async setActiveFrontstage(frontstageId: string): Promise<void> {
    return internal.setActiveFrontstage(frontstageId);
  }

  /** Sets the active FrontstageDef.
     * @param  frontstageDef  FrontstageDef to set active.
     * @returns A Promise that is fulfilled when the [[FrontstageDef]] is ready.
     */
  public static async setActiveFrontstageDef(frontstageDef: FrontstageDef | undefined): Promise<void> {
    return internal.setActiveFrontstageDef(frontstageDef);
  }

  /** Deactivates the active FrontstageDef.
     */
  public static async deactivateFrontstageDef(): Promise<void> {
    return internal.deactivateFrontstageDef();
  }

  /** Gets the Id of the active tool. If a tool is not active, blank is returned.
     * @return  Id of the active tool, or blank if one is not active.
     */
  public static get activeToolId(): string {
    return internal.activeToolId;
  }

  /** Sets the active tool id */
  public static setActiveToolId(toolId: string): void {
    return internal.setActiveToolId(toolId);
  }

  /** Sets the active tool */
  public static setActiveTool(tool: Tool): void {
    return internal.setActiveTool(tool);
  }

  /** Gets the active tool's [[ToolInformation]] */
  public static get activeToolInformation(): ToolInformation | undefined {
    return internal.activeToolInformation;
  }

  /** Gets the Tool Setting React node of the active tool.
     * @return  Tool Setting React node of the active tool, or undefined if there is no active tool or Tool Settings for the active tool.
     * @internal
     */
  public static get activeToolSettingsProvider(): ToolUiProvider | undefined {
    return internal.activeToolSettingsProvider;
  }

  /** Sets the active layout, content group and active content.
     * @param contentLayoutDef  Content layout to make active
     * @param contentGroup  Content Group to make active
     */
  public static async setActiveLayout(contentLayoutDef: ContentLayoutDef, contentGroup: ContentGroup): Promise<void> {
    return internal.setActiveLayout(contentLayoutDef, contentGroup);
  }

  /** Sets the active layout, content group and active content.
     * @param contentGroup  Content Group to make active
     */
  public static async setActiveContentGroup(contentGroup: ContentGroup): Promise<void> {
    return internal.setActiveContentGroup(contentGroup);
  }

  /** Opens a modal Frontstage. Modal Frontstages can be stacked.
     * @param modalFrontstage  Information about the modal Frontstage
     */
  public static openModalFrontstage(modalFrontstage: ModalFrontstageInfo): void {
    return internal.openModalFrontstage(modalFrontstage);
  }

  /** Closes the top-most modal Frontstage.
     */
  public static closeModalFrontstage(): void {
    return internal.closeModalFrontstage();
  }

  /** Updates the top-most modal Frontstage.
     */
  public static updateModalFrontstage(): void {
    return internal.updateModalFrontstage();
  }

  /** Gets the top-most modal Frontstage.
     * @returns Top-most modal Frontstage, or undefined if there is none.
     */
  public static get activeModalFrontstage(): ModalFrontstageInfo | undefined {
    return internal.activeModalFrontstage;
  }

  /** Gets the number of modal Frontstages.
     * @returns Modal Frontstage count
     */
  public static get modalFrontstageCount(): number {
    return internal.modalFrontstageCount;
  }

  /** Sets the active Navigation Aid via its Id.
     * @param navigationAidId  Id of the Navigation Aid to set as active
     * @param iModelConnection IModelConnection to query for view data
     */
  public static setActiveNavigationAid(navigationAidId: string, iModelConnection: IModelConnection) {
    return internal.setActiveNavigationAid(navigationAidId, iModelConnection);
  }

  /** Sets the state of the widget with the given id
     * @param widgetId  Id of the Widget for which to set the state
     * @param state     New state of the widget
     * @returns true if the widget state was set successfully, or false if not.
     */
  public static setWidgetState(widgetId: string, state: WidgetState): boolean {
    return internal.setWidgetState(widgetId, state);
  }

  /** Finds a widget with the given id in the active frontstage
     * @param widgetId  Id of the Widget to find
     * @returns The WidgetDef with the given id, or undefined if not found.
     */
  public static findWidget(widgetId: string): WidgetDef | undefined {
    return internal.findWidget(widgetId);
  }

  /** Opens a nested Frontstage. Nested Frontstages can be stacked.
     * @param nestedFrontstage  Information about the nested Frontstage
     */
  public static async openNestedFrontstage(nestedFrontstage: FrontstageDef): Promise<void> {
    return internal.openNestedFrontstage(nestedFrontstage);
  }

  /** Closes the top-most nested Frontstage.
     */
  public static async closeNestedFrontstage(): Promise<void> {
    return internal.closeNestedFrontstage();
  }

  /** Gets the top-most nested Frontstage.
     * @returns Top-most nested Frontstage, or undefined if there is none.
     */
  public static get activeNestedFrontstage(): FrontstageDef | undefined {
    return internal.activeNestedFrontstage;
  }

  /** Gets the number of nested Frontstages.
     * @returns Nested Frontstage count
     */
  public static get nestedFrontstageCount(): number {
    return internal.nestedFrontstageCount;
  }
}
