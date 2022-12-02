/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Frontstage
 */

// cSpell:ignore popout

import * as React from "react";
import { IModelApp, ScreenViewport } from "@itwin/core-frontend";
import { PointProps, StagePanelLocation, StageUsage, UiError, WidgetState } from "@itwin/appui-abstract";
import { Rectangle, RectangleProps, SizeProps } from "@itwin/core-react";
import {
  dockWidgetContainer,
  floatWidget, getTabLocation, getWidgetLocation, isFloatingTabLocation, isPanelTabLocation, isPopoutTabLocation, isPopoutWidgetLocation,
  NineZoneManagerProps, NineZoneState, PanelSide, panelSides, popoutWidgetToChildWindow, setFloatingWidgetContainerBounds,
} from "@itwin/appui-layout-react";
import { ContentControl } from "../content/ContentControl";
import { ContentGroup, ContentGroupProvider } from "../content/ContentGroup";
import { ContentLayoutDef } from "../content/ContentLayout";
import { ContentLayoutManager } from "../content/ContentLayoutManager";
import { ContentViewManager } from "../content/ContentViewManager";
import { ToolItemDef } from "../shared/ToolItemDef";
import { StagePanelDef, StagePanelState, toPanelSide } from "../stagepanels/StagePanelDef";
import { UiFramework } from "../UiFramework";
import { WidgetControl } from "../widgets/WidgetControl";
import { WidgetDef } from "../widgets/WidgetDef";
import { Zone, ZoneLocation, ZoneProps } from "../zones/Zone";
import { ZoneDef } from "../zones/ZoneDef";
import { Frontstage, FrontstageProps } from "./Frontstage";
import { FrontstageManager } from "./FrontstageManager";
import { FrontstageProvider } from "./FrontstageProvider";
import { TimeTracker } from "../configurableui/TimeTracker";
import { ChildWindowLocationProps } from "../childwindow/ChildWindowManager";
import { PopoutWidget } from "../childwindow/PopoutWidget";
import { SavedWidgets } from "../widget-panels/Frontstage";
import { assert, BentleyStatus, ProcessDetector } from "@itwin/core-bentley";
import { ContentDialogManager } from "../dialog/ContentDialogManager";
import { FrontstageConfig } from "./FrontstageConfig";
import { Widget } from "../widgets/Widget";
import { WidgetConfig } from "../widgets/WidgetConfig";
import { StagePanel, StagePanelProps, StagePanelZonesProps } from "../stagepanels/StagePanel";
import { StagePanelConfig } from "../stagepanels/StagePanelConfig";
import { WidgetProps } from "../widgets/WidgetProps";
import { CoreTools } from "../tools/CoreToolDefinitions";

/** @internal */
export interface FrontstageEventArgs {
  frontstageDef: FrontstageDef;
}

/** @internal */
export interface FrontstageNineZoneStateChangedEventArgs extends FrontstageEventArgs {
  state: NineZoneState | undefined;
}

/** FrontstageDef class provides an API for a Frontstage.
 * @public
 */
export class FrontstageDef {
  private _id: string = "";
  private _initialProps?: FrontstageProps;
  private _defaultTool?: ToolItemDef;
  private _defaultContentId: string = "";
  private _isInFooterMode: boolean = true;
  private _isStageClosing = false;
  private _isReady = false;
  private _isApplicationClosing = false;
  private _applicationData?: any;
  private _usage?: string;
  private _version: number = 0;
  private _topLeft?: ZoneDef;
  private _topCenter?: ZoneDef;
  private _topRight?: ZoneDef;
  private _centerLeft?: ZoneDef;
  private _centerRight?: ZoneDef;
  private _bottomLeft?: ZoneDef;
  private _bottomCenter?: ZoneDef;
  private _bottomRight?: ZoneDef;
  private _topPanel?: StagePanelDef;
  private _topMostPanel?: StagePanelDef;
  private _leftPanel?: StagePanelDef;
  private _rightPanel?: StagePanelDef;
  private _bottomPanel?: StagePanelDef;
  private _bottomMostPanel?: StagePanelDef;
  private _contentLayoutDef?: ContentLayoutDef;
  private _contentGroup?: ContentGroup;
  private _frontstageProvider?: FrontstageProvider;
  private _nineZone?: NineZoneManagerProps;
  private _timeTracker: TimeTracker = new TimeTracker();
  private _nineZoneState?: NineZoneState;
  private _contentGroupProvider?: ContentGroupProvider;
  private _floatingContentControls?: ContentControl[];
  private _savedWidgetDefs?: SavedWidgets;

  public get id(): string { return this._id; }
  /** @deprecated */
  public get defaultTool(): ToolItemDef | undefined { return this._defaultTool; }
  /** @deprecated */
  public get defaultContentId(): string { return this._defaultContentId; }
  public get isInFooterMode(): boolean { return this._isInFooterMode; }
  /** @deprecated */
  public get applicationData(): any | undefined { return this._applicationData; }
  public get usage(): string { return this._usage !== undefined ? this._usage : StageUsage.General; }
  public get version(): number { return this._version; }
  public get contentGroupProvider(): ContentGroupProvider | undefined { return this._contentGroupProvider; }
  public get floatingContentControls() { return this._floatingContentControls; }

  /** @deprecated Use [[FrontstageDef.contentManipulation]] instead. */
  public get topLeft(): ZoneDef | undefined { return this._topLeft; }
  /** @deprecated Use [[FrontstageDef.toolSettings]] instead. */
  public get topCenter(): ZoneDef | undefined { return this._topCenter; }
  /** @deprecated Use [[FrontstageDef.viewNavigation]] instead. */
  public get topRight(): ZoneDef | undefined { return this._topRight; }
  /** @deprecated Use [[FrontstageDef.leftPanel]] instead. */
  public get centerLeft(): ZoneDef | undefined { return this._centerLeft; }
  /** @deprecated Use [[FrontstageDef.rightPanel]] instead. */
  public get centerRight(): ZoneDef | undefined { return this._centerRight; }
  /** @deprecated Use [[FrontstageDef.leftPanel]] instead. */
  public get bottomLeft(): ZoneDef | undefined { return this._bottomLeft; }
  /** @deprecated Use [[FrontstageDef.statusBar]] instead. */
  public get bottomCenter(): ZoneDef | undefined { return this._bottomCenter; }
  /** @deprecated Use [[FrontstageDef.rightPanel]] instead. */
  public get bottomRight(): ZoneDef | undefined { return this._bottomRight; }

  /** @beta */
  public get toolSettings(): WidgetDef | undefined { return this.topCenter?.getSingleWidgetDef(); }
  /** @beta */
  public get statusBar(): WidgetDef | undefined { return this.bottomCenter?.getSingleWidgetDef(); }
  /** @beta */
  public get contentManipulation(): WidgetDef | undefined { return this.topLeft?.getSingleWidgetDef(); }
  /** @beta */
  public get viewNavigation(): WidgetDef | undefined { return this.topRight?.getSingleWidgetDef(); }

  /** @beta */
  public get topPanel(): StagePanelDef | undefined { return this._topPanel; }
  /** @beta
   * @deprecated Only topPanel is supported in UI 2.0 */
  public get topMostPanel(): StagePanelDef | undefined { return this._topMostPanel; }
  /** @beta */
  public get leftPanel(): StagePanelDef | undefined { return this._leftPanel; }
  /** @beta */
  public get rightPanel(): StagePanelDef | undefined { return this._rightPanel; }
  /** @beta */
  public get bottomPanel(): StagePanelDef | undefined { return this._bottomPanel; }
  /** @beta
   * @deprecated Only bottomPanel is supported in UI 2.0  */
  public get bottomMostPanel(): StagePanelDef | undefined { return this._bottomMostPanel; }

  public get contentLayoutDef(): ContentLayoutDef | undefined { return this._contentLayoutDef; }
  public get contentGroup(): ContentGroup | undefined { return this._contentGroup; }
  public get frontstageProvider(): FrontstageProvider | undefined { return this._frontstageProvider; }

  /** @internal */
  public get nineZone(): NineZoneManagerProps | undefined { return this._nineZone; } // istanbul ignore next
  public set nineZone(props: NineZoneManagerProps | undefined) { this._nineZone = props; }

  private toStagePanelLocation(side: PanelSide): StagePanelLocation {
    switch (side) {
      case "bottom":
        return StagePanelLocation.Bottom;
      case "left":
        return StagePanelLocation.Left;
      case "right":
        return StagePanelLocation.Right;
      case "top":
        return StagePanelLocation.Top;
    }
  }

  private populateStateMaps(nineZone: NineZoneState, panelMap: Map<StagePanelDef, StagePanelState>, widgetMap: Map<WidgetDef, WidgetState>) {
    for (const panelSide of panelSides) {
      const panel = nineZone.panels[panelSide];
      const location = this.toStagePanelLocation(panelSide);
      const panelDef = this.getStagePanelDef(location);
      if (panelDef) {
        const panelState = panel.collapsed ? StagePanelState.Minimized : StagePanelState.Open;
        panelMap.set(panelDef, panelState);
      }
      for (const widgetId of panel.widgets) {
        const widget = nineZone.widgets[widgetId];
        // istanbul ignore else
        if (widget) {
          for (const tabId of widget.tabs) {
            const widgetDef = this.findWidgetDef(tabId);
            if (widgetDef) {
              let widgetState = WidgetState.Open;
              if (widget.minimized || tabId !== widget.activeTabId)
                widgetState = WidgetState.Closed;
              widgetMap.set(widgetDef, widgetState);
            }
          }
        }
      }
    }
    // istanbul ignore next
    for (const widgetId of nineZone.floatingWidgets.allIds) {
      const widget = nineZone.widgets[widgetId];
      if (widget) {
        for (const tabId of widget.tabs) {
          const widgetDef = this.findWidgetDef(tabId);
          if (widgetDef) {
            let widgetState = WidgetState.Open;
            if (widget.minimized || tabId !== widget.activeTabId)
              widgetState = WidgetState.Closed;
            widgetMap.set(widgetDef, widgetState);
          }
        }
      }
    }
  }

  private triggerStateChangeEventForWidgetsAndPanels(state: NineZoneState | undefined) {
    // istanbul ignore else
    if (!(this._isStageClosing || this._isApplicationClosing)) {
      if (state) {
        const originalPanelStateMap = new Map<StagePanelDef, StagePanelState>();
        const originalWidgetStateMap = new Map<WidgetDef, WidgetState>();
        const newPanelStateMap = new Map<StagePanelDef, StagePanelState>();
        const newWidgetStateMap = new Map<WidgetDef, WidgetState>();
        this._nineZoneState && this.populateStateMaps(this._nineZoneState, originalPanelStateMap, originalWidgetStateMap);
        this.populateStateMaps(state, newPanelStateMap, newWidgetStateMap);

        // set internal state value before triggering events
        this._nineZoneState = state;

        // now walk and trigger set state events
        newWidgetStateMap.forEach((stateValue, widgetDef) => {
          const originalState = originalWidgetStateMap.get(widgetDef);
          if (originalState !== stateValue) {
            FrontstageManager.onWidgetStateChangedEvent.emit({ widgetDef, widgetState: stateValue });
            widgetDef.onWidgetStateChanged();
          }
        });
        newPanelStateMap.forEach((stateValue, panelDef) => {
          const originalState = originalPanelStateMap.get(panelDef);
          if (originalState !== stateValue) {
            FrontstageManager.onPanelStateChangedEvent.emit({
              panelDef,
              panelState: stateValue,
            });
          }
        });
      } else {
        this._nineZoneState = state;
      }
    }
  }

  /** @internal */
  public get nineZoneState(): NineZoneState | undefined { return this._nineZoneState; }
  public set nineZoneState(state: NineZoneState | undefined) {
    if (this._nineZoneState === state)
      return;

    if ("1" === UiFramework.uiVersion || !this._nineZoneState) {
      this._nineZoneState = state;
    } else {
      this.triggerStateChangeEventForWidgetsAndPanels(state);
    }

    // istanbul ignore next - don't trigger any side effects until stage "isReady"
    if (!(this._isStageClosing || this._isApplicationClosing) || this.isReady) {
      FrontstageManager.onFrontstageNineZoneStateChangedEvent.emit({
        frontstageDef: this,
        state,
      });
    }
  }

  /** @internal */
  public get savedWidgetDefs() { return this._savedWidgetDefs; }
  public set savedWidgetDefs(widgets: SavedWidgets | undefined) {
    this._savedWidgetDefs = widgets;
  }

  /** @internal */
  public get timeTracker(): TimeTracker { return this._timeTracker; }

  /** Created a [[FrontstageDef]] and initialize it */
  public static async create(provider: FrontstageProvider) {
    const def = new FrontstageDef();
    def._frontstageProvider = provider;

    if (provider.frontstageConfig) {
      const config = provider.frontstageConfig();
      const props = toFrontstageProps(config);
      await def.initializeFromProps(props);
    } else {
      await def.initializeFromProps(provider.frontstage.props);
    }

    return def;
  }

  /** Handles when the Frontstage becomes activated */
  protected async _onActivated() { }

  /** Handles when the Frontstage becomes activated */
  public async onActivated() {
    this.updateWidgetDefs();

    const provider = this._contentGroupProvider;
    if (provider && this._initialProps) {
      if (provider.contentGroup) {
        const config = toFrontstageConfig(this._initialProps);
        this._contentGroup = await provider.contentGroup(config);
      } else {
        this._contentGroup = await provider.provideContentGroup(this._initialProps);
      }
    }

    // istanbul ignore next
    if (!this._contentGroup)
      throw new UiError(UiFramework.loggerCategory(this), `onActivated: Content Group not defined`);

    this._contentLayoutDef = ContentLayoutManager.getLayoutForGroup(this._contentGroup);
    FrontstageManager.onContentLayoutActivatedEvent.emit({ contentLayout: this._contentLayoutDef, contentGroup: this._contentGroup });

    this._timeTracker.startTiming();
    await this._onActivated();
  }

  /** Handles when the Frontstage becomes inactive */
  protected async _onDeactivated() { }

  /** Handles when the Frontstage becomes inactive */
  public async onDeactivated() {
    for (const control of this._widgetControls) {
      control.onFrontstageDeactivated();
    }

    for (const control of this.contentControls) {
      control.onFrontstageDeactivated();
    }

    // istanbul ignore else
    if (this.contentGroup)
      this.contentGroup.onFrontstageDeactivated();
    // istanbul ignore next
    if (this.contentGroupProvider)
      await this.contentGroupProvider.onFrontstageDeactivated();

    this._timeTracker.stopTiming();

    this._isStageClosing = true; // this keeps widgets in child windows from automatically re-docking
    UiFramework.childWindowManager.closeAllChildWindows();

    if (this._floatingContentControls) {
      ContentDialogManager.closeAll();
      this._floatingContentControls = undefined;
    }

    await this._onDeactivated();
    this._isStageClosing = false;
  }

  /** @internal */
  public setIsApplicationClosing(value: boolean) {
    this._isApplicationClosing = value;
  }

  /** Returns once the contained widgets and content controls are ready to use */
  public async waitUntilReady(): Promise<void> {
    this._isReady = false;
    // create an array of control-ready promises
    const controlReadyPromises = new Array<Promise<void>>();
    this._widgetControls.forEach((control: WidgetControl) => {
      controlReadyPromises.push(control.isReady);
    });

    // istanbul ignore else
    if (this.contentLayoutDef) {
      const usedContentIndexes = this.contentLayoutDef.getUsedContentIndexes();
      this.contentControls.forEach((control: ContentControl, index: number) => {
        // istanbul ignore else
        if (usedContentIndexes.includes(index))
          controlReadyPromises.push(control.isReady);
      });
    }

    await Promise.all(controlReadyPromises);
    // Frontstage ready
    this._isReady = true;
  }

  /** Handles when the Frontstage becomes active */
  protected _onFrontstageReady(): void { }

  /** Handles when the Frontstage becomes active */
  public onFrontstageReady(): void {
    for (const control of this._widgetControls) {
      control.onFrontstageReady();
    }

    for (const control of this.contentControls) {
      control.onFrontstageReady();
    }

    // istanbul ignore else
    if (this.contentGroup)
      this.contentGroup.onFrontstageReady();

    this._onFrontstageReady();
  }

  /** Starts the default tool for the Frontstage.
   * @deprecated
   */
  public startDefaultTool(): void {
    // Start the default tool
    // istanbul ignore next
    if (IModelApp.toolAdmin && IModelApp.viewManager) {
      if (this.defaultTool) {
        IModelApp.toolAdmin.defaultToolId = this.defaultTool.toolId;
        this.defaultTool.execute();
      } else {
        IModelApp.toolAdmin.startDefaultTool(); // eslint-disable-line @typescript-eslint/no-floating-promises
      }
    }
  }

  /** Sets the Content Layout and Content Group */
  public setContentLayoutAndGroup(contentLayoutDef: ContentLayoutDef, contentGroup: ContentGroup): void {
    this._contentLayoutDef = contentLayoutDef;
    this._contentGroup = contentGroup;
  }

  /** Sets the active view content control to the default or first */
  public async setActiveContent(): Promise<boolean> {
    let contentControl: ContentControl | undefined;
    let activated = false;

    if (this.contentGroup && this.defaultContentId) {
      contentControl = this.contentGroup.getContentControlById(this.defaultContentId);
    }

    // istanbul ignore else
    if (!contentControl && this.contentControls.length >= 0) {
      contentControl = this.contentControls[0];
    }

    if (contentControl) {
      ContentViewManager.setActiveContent(contentControl.reactNode, true);
      if (contentControl.viewport) {
        const status = await IModelApp.viewManager.setSelectedView(contentControl.viewport);
        activated = status === BentleyStatus.SUCCESS;
      }
    }

    return activated;
  }

  /** Sets the active view content control */
  public setActiveView(newContent: ContentControl, oldContent?: ContentControl): void {
    if (oldContent)
      oldContent.onDeactivated();
    newContent.onActivated();
    FrontstageManager.onContentControlActivatedEvent.emit({ activeContentControl: newContent, oldContentControl: oldContent });
  }

  /** Sets the active view content control based on the selected viewport. */
  public setActiveViewFromViewport(viewport: ScreenViewport): boolean {
    const contentControl = this.contentControls.find((control: ContentControl) => control.viewport === viewport);
    // istanbul ignore else
    if (contentControl) {
      ContentViewManager.setActiveContent(contentControl.reactNode, true);
      return true;
    }

    // istanbul ignore next
    return false;
  }

  /** Gets a [[ZoneDef]] based on a given zone id.
   * @deprecated UI1.0 is deprecated.
   */
  public getZoneDef(zoneId: number): ZoneDef | undefined {
    let zoneDef;

    switch (zoneId) {
      case 1:
        zoneDef = this.topLeft;
        break;
      case 2:
        zoneDef = this.topCenter;
        break;
      case 3:
        zoneDef = this.topRight;
        break;
      case 4:
        zoneDef = this.centerLeft;
        break;
      case 6:
        zoneDef = this.centerRight;
        break;
      case 7:
        zoneDef = this.bottomLeft;
        break;
      case 8:
        zoneDef = this.bottomCenter;
        break;
      case 9:
        zoneDef = this.bottomRight;
        break;
      // istanbul ignore next
      default:
        throw new RangeError();
    }

    // Zones can be undefined in a Frontstage

    return zoneDef;
  }

  /** Gets a list of [[ZoneDef]]s.
   * @deprecated UI1.0 is deprecated.
   */
  public get zoneDefs(): ZoneDef[] {
    const zones = [1, 2, 3, 4, 6, 7, 8, 9];
    const zoneDefs: ZoneDef[] = [];

    zones.forEach((zoneId) => {
      const zoneDef = this.getZoneDef(zoneId);
      if (zoneDef)
        zoneDefs.push(zoneDef);
    });

    return zoneDefs;
  }

  /** Gets a [[StagePanelDef]] based on a given panel location
   * @beta
   */
  public getStagePanelDef(location: StagePanelLocation): StagePanelDef | undefined {
    let panelDef: StagePanelDef | undefined;

    switch (location) {
      case StagePanelLocation.Top:
        panelDef = this.topPanel;
        break;
      case StagePanelLocation.TopMost:
        panelDef = this.topMostPanel; // eslint-disable-line deprecation/deprecation
        break;
      case StagePanelLocation.Left:
        panelDef = this.leftPanel;
        break;
      case StagePanelLocation.Right:
        panelDef = this.rightPanel;
        break;
      case StagePanelLocation.Bottom:
        panelDef = this.bottomPanel;
        break;
      case StagePanelLocation.BottomMost:
        panelDef = this.bottomMostPanel; // eslint-disable-line deprecation/deprecation
        break;
      // istanbul ignore next
      default:
        throw new RangeError();
    }

    // Panels can be undefined in a Frontstage

    return panelDef;
  }

  /** Gets a list of [[StagePanelDef]]s
   * @beta
   */
  public get panelDefs(): StagePanelDef[] {
    const panels = [
      StagePanelLocation.Left, StagePanelLocation.Right,
      StagePanelLocation.Top, StagePanelLocation.TopMost,
      StagePanelLocation.Bottom, StagePanelLocation.BottomMost,
    ];
    const panelDefs: StagePanelDef[] = [];

    panels.forEach((location: StagePanelLocation) => {
      const panelDef = this.getStagePanelDef(location);
      if (panelDef)
        panelDefs.push(panelDef);
    });

    return panelDefs;
  }

  /** Finds a [[WidgetDef]] based on a given id */
  public findWidgetDef(id: string): WidgetDef | undefined {
    for (const zoneDef of this.zoneDefs) {
      const widgetDef = zoneDef.findWidgetDef(id);
      if (widgetDef)
        return widgetDef;
    }

    for (const panelDef of this.panelDefs) {
      const widgetDef = panelDef.findWidgetDef(id);
      if (widgetDef)
        return widgetDef;
    }

    // istanbul ignore next
    return undefined;
  }

  /** Gets the list of [[WidgetControl]]s */
  private get _widgetControls(): WidgetControl[] {
    const widgetControls = new Array<WidgetControl>();

    this.zoneDefs.forEach((zoneDef: ZoneDef) => {
      zoneDef.widgetDefs.forEach((widgetDef: WidgetDef) => {
        const widgetControl = widgetDef.widgetControl;
        if (widgetControl)
          widgetControls.push(widgetControl);
      });
    });

    this.panelDefs.forEach((panelDef: StagePanelDef) => {
      panelDef.widgetDefs.forEach((widgetDef: WidgetDef) => {
        const widgetControl = widgetDef.widgetControl;
        // istanbul ignore if
        if (widgetControl)
          widgetControls.push(widgetControl);
      });
    });

    return widgetControls;
  }

  public addFloatingContentControl(contentControl?: ContentControl) {
    // istanbul ignore next
    if (!contentControl)
      return;
    if (!this._floatingContentControls)
      this._floatingContentControls = new Array<ContentControl>();

    this._floatingContentControls.push(contentControl);
    ContentViewManager.onAvailableContentChangedEvent.emit({ contentId: contentControl.uniqueId });
  }

  public dropFloatingContentControl(contentControl?: ContentControl) {
    // istanbul ignore next
    if (!contentControl || !this._floatingContentControls)
      return;

    const index = this._floatingContentControls.indexOf(contentControl);
    // istanbul ignore else
    if (index > -1) {
      this._floatingContentControls.splice(index, 1);
      ContentViewManager.onAvailableContentChangedEvent.emit({ contentId: contentControl.uniqueId });
    }
  }

  /** Gets the list of [[ContentControl]]s */
  public get contentControls(): ContentControl[] {
    const contentControls = new Array<ContentControl>();
    // istanbul ignore else
    if (this.contentGroup) {
      contentControls.push(...this.contentGroup.getContentControls());
    }
    if (this._floatingContentControls) {
      contentControls.push(...this._floatingContentControls);
    }
    return contentControls;
  }

  /** Initializes a FrontstageDef from FrontstageProps
   * @internal
   */
  public async initializeFromProps(props: FrontstageProps): Promise<void> {
    this._id = props.id;
    this._initialProps = props;
    this._defaultTool = props.defaultTool;

    if (props.defaultContentId !== undefined)
      this._defaultContentId = props.defaultContentId;

    if (props.contentGroup instanceof ContentGroupProvider) {
      this._contentGroupProvider = props.contentGroup;
    } else {
      this._contentGroup = props.contentGroup;
    }

    if (props.isInFooterMode !== undefined)
      this._isInFooterMode = props.isInFooterMode;
    this._applicationData = props.applicationData;

    this._usage = props.usage;
    this._version = props.version || 0;

    // eslint-disable-next-line deprecation/deprecation
    this._topLeft = Frontstage.createZoneDef(props.contentManipulationTools ? props.contentManipulationTools : props.topLeft, ZoneLocation.TopLeft, props);
    // eslint-disable-next-line deprecation/deprecation
    this._topCenter = Frontstage.createZoneDef(props.toolSettings ? props.toolSettings : props.topCenter, ZoneLocation.TopCenter, props);
    // eslint-disable-next-line deprecation/deprecation
    this._topRight = Frontstage.createZoneDef(props.viewNavigationTools ? /* istanbul ignore next */ props.viewNavigationTools : props.topRight, ZoneLocation.TopRight, props);
    // eslint-disable-next-line deprecation/deprecation
    this._centerLeft = Frontstage.createZoneDef(props.centerLeft, ZoneLocation.CenterLeft, props);
    // eslint-disable-next-line deprecation/deprecation
    this._centerRight = Frontstage.createZoneDef(props.centerRight, ZoneLocation.CenterRight, props);
    // eslint-disable-next-line deprecation/deprecation
    this._bottomLeft = Frontstage.createZoneDef(props.bottomLeft, ZoneLocation.BottomLeft, props);
    // eslint-disable-next-line deprecation/deprecation
    this._bottomCenter = Frontstage.createZoneDef(props.statusBar ? props.statusBar : props.bottomCenter, ZoneLocation.BottomCenter, props);
    // eslint-disable-next-line deprecation/deprecation
    this._bottomRight = Frontstage.createZoneDef(props.bottomRight, ZoneLocation.BottomRight, props);
    // eslint-disable-next-line deprecation/deprecation

    this._topPanel = Frontstage.createStagePanelDef(StagePanelLocation.Top, props);
    this._topMostPanel = Frontstage.createStagePanelDef(StagePanelLocation.TopMost, props);
    this._leftPanel = Frontstage.createStagePanelDef(StagePanelLocation.Left, props);
    this._rightPanel = Frontstage.createStagePanelDef(StagePanelLocation.Right, props);
    this._bottomPanel = Frontstage.createStagePanelDef(StagePanelLocation.Bottom, props);
    this._bottomMostPanel = Frontstage.createStagePanelDef(StagePanelLocation.BottomMost, props);
  }

  /** @internal */
  public updateWidgetDefs(): void {
    // Tracks provided widgets to prevent duplicates.
    const allStageWidgetDefs: WidgetDef[] = [];

    // Process panels before zones so in uiVersion="2" extension can explicitly target a widget for a StagePanelSection
    this.panelDefs.forEach((stagePanelDef: StagePanelDef) => {
      stagePanelDef.updateDynamicWidgetDefs(this.id, this.usage, stagePanelDef.location, undefined, allStageWidgetDefs, this.applicationData);
    });

    this.zoneDefs.forEach((zoneDef: ZoneDef) => {
      zoneDef.updateDynamicWidgetDefs(this.id, this.usage, zoneDef.zoneLocation, undefined, allStageWidgetDefs, this.applicationData);
    });
  }

  /** @beta */
  public restoreLayout() {
    for (const panelDef of this.panelDefs) {
      panelDef.size = panelDef.defaultSize;
      panelDef.panelState = panelDef.defaultState;
    }
    for (const widgetDef of this.widgetDefs) {
      widgetDef.setWidgetState(widgetDef.defaultState);
    }
    FrontstageManager.onFrontstageRestoreLayoutEvent.emit({ frontstageDef: this });
  }

  /** Used only in UI 2.0 to determine WidgetState from NinezoneState
   *  @internal
   */
  public getWidgetCurrentState(widgetDef: WidgetDef): WidgetState | undefined {
    // istanbul ignore else
    if (this.nineZoneState) {
      const location = getTabLocation(this.nineZoneState, widgetDef.id);
      // istanbul ignore next
      if (!location)
        return WidgetState.Hidden;

      if (isFloatingTabLocation(location)) {
        const floatingWidget = this.nineZoneState.floatingWidgets.byId[location.floatingWidgetId];
        if (floatingWidget && floatingWidget.hidden)
          return WidgetState.Hidden;
        else
          return WidgetState.Floating;
      }

      let collapsedPanel = false;
      // istanbul ignore else
      if ("side" in location) {
        const panel = this.nineZoneState.panels[location.side];
        collapsedPanel = panel.collapsed || undefined === panel.size || 0 === panel.size;
      }
      const widgetContainer = this.nineZoneState.widgets[location.widgetId];
      if (widgetDef.id === widgetContainer.activeTabId && !collapsedPanel)
        return WidgetState.Open;
      else
        return WidgetState.Closed;
    }
    return widgetDef.defaultState;
  }

  /** Used only in UI 2.0 to determine StagePanelState and size from NinezoneState
   *  @internal
   */
  public getPanelCurrentState(panelDef: StagePanelDef): [StagePanelState, number] {
    // istanbul ignore next
    if (this.nineZoneState) {
      const side = toPanelSide(panelDef.location);
      const panel = this.nineZoneState.panels[side];
      if (panel)
        return [panel.collapsed ? StagePanelState.Minimized : StagePanelState.Open, panel.size ?? 0];
      return [StagePanelState.Off, 0];
    }
    return [panelDef.defaultState, panelDef.defaultSize ?? 0];
  }

  public isPopoutWidget(widgetId: string) {
    // istanbul ignore else
    if (this.nineZoneState) {
      const location = getTabLocation(this.nineZoneState, widgetId);
      // istanbul ignore else
      if (location)
        return isPopoutTabLocation(location);
    }

    return false;
  }

  public isFloatingWidget(widgetId: string) {
    // istanbul ignore else
    if (this.nineZoneState) {
      const location = getTabLocation(this.nineZoneState, widgetId);
      // istanbul ignore else
      if (location)
        return isFloatingTabLocation(location);
    }

    return false;
  }

  /** Create a new floating panel that contains the widget specified by its Id. Supported only when in
   *  UI 2.0 or higher.
   * @param widgetId case sensitive Widget Id
   * @param point Position of top left corner of floating panel in pixels. If undefined {x:50, y:100} is used.
   * @param size defines the width and height of the floating panel. If undefined and widget has been floated before
   * the previous size is used, else {height:400, width:400} is used.
   * @beta
   */
  public floatWidget(widgetId: string, point?: PointProps, size?: SizeProps) {
    // istanbul ignore else
    if (this.nineZoneState) {
      const location = getTabLocation(this.nineZoneState, widgetId);
      if (location) {
        let popoutWidgetContainerId: string | undefined;
        if (isPopoutTabLocation(location)) {
          popoutWidgetContainerId = location.popoutWidgetId;
        }
        const state = floatWidget(this.nineZoneState, widgetId, point, size);
        // istanbul ignore else
        if (state) {
          this.nineZoneState = state;
          setTimeout(() => {
            popoutWidgetContainerId && UiFramework.childWindowManager.closeChildWindow(popoutWidgetContainerId, true);
          }, 600);
        }
      }
    }
  }
  /** Check widget and panel state to determine whether the widget is currently displayed
   * @param widgetId case-sensitive Widget Id
   * @public
   */
  public isWidgetDisplayed(widgetId: string) {
    let widgetIsVisible = false;
    // istanbul ignore else
    if (this.nineZoneState) {
      const tabLocation = getTabLocation(this.nineZoneState, widgetId);
      // istanbul ignore else
      if (tabLocation) {
        if (isFloatingTabLocation(tabLocation)) {
          const floatingWidget = this.nineZoneState.floatingWidgets.byId[tabLocation.floatingWidgetId];
          // istanbul ignore else
          if (!!!floatingWidget.hidden)
            widgetIsVisible = true;
        } else if (isPopoutTabLocation(tabLocation)) {
          widgetIsVisible = true;
        } else {
          // istanbul ignore else
          if (isPanelTabLocation(tabLocation)) {
            const panel = this.nineZoneState.panels[tabLocation.side];
            const widgetDef = this.findWidgetDef(widgetId);
            if (widgetDef && widgetDef.state === WidgetState.Open && !panel.collapsed)
              widgetIsVisible = true;
          }
        }
      }
    }
    return widgetIsVisible;
  }

  /** Opens window for specified PopoutWidget container. Used to reopen popout when running in Electron.
   * @internal */
  public openPopoutWidgetContainer(state: NineZoneState, widgetContainerId: string) {
    const location = getWidgetLocation(state, widgetContainerId);
    // istanbul ignore next
    if (!location)
      return;
    // istanbul ignore next
    if (!isPopoutWidgetLocation(location))
      return;

    const widget = state.widgets[widgetContainerId];
    const popoutWidget = state.popoutWidgets.byId[location.popoutWidgetId];

    // Popout widget should only contain a single tab.
    // istanbul ignore next
    if (widget.tabs.length !== 1)
      return;

    const tabId = widget.tabs[0];
    const widgetDef = this.findWidgetDef(tabId);
    // istanbul ignore next
    if (!widgetDef)
      return;

    const popoutContent = (<PopoutWidget widgetContainerId={widgetContainerId} widgetDef={widgetDef} />);
    const bounds = Rectangle.create(popoutWidget.bounds);

    const position: ChildWindowLocationProps = {
      width: bounds.getWidth(),
      height: bounds.getHeight(),
      left: bounds.left,
      top: bounds.top,
    };
    UiFramework.childWindowManager.openChildWindow(widgetContainerId, widgetDef.label, popoutContent, position, UiFramework.useDefaultPopoutUrl);
  }

  /** Create a new popout/child window that contains the widget specified by its Id. Supported only when in
   *  UI 2.0 or higher.
   * @param widgetId case sensitive Widget Id
   * @param point Position of top left corner of floating panel in pixels. If undefined {x:0, y:0} is used.
   * @param size defines the width and height of the floating panel. If undefined and widget has been floated before
   * the previous size is used, else {height:800, width:600} is used.
   * @beta
   */
  public popoutWidget(widgetId: string, point?: PointProps, size?: SizeProps) {
    // istanbul ignore next
    if (!this.nineZoneState)
      return;

    let location = getTabLocation(this.nineZoneState, widgetId);
    if (!location || isPopoutTabLocation(location))
      return;

    const widgetDef = this.findWidgetDef(widgetId);
    // istanbul ignore next
    if (!widgetDef)
      return;

    // get the state to apply that will pop-out the specified WidgetTab to child window.
    let preferredBounds = Rectangle.createFromSize({ height: 800, width: 600 });
    // istanbul ignore next
    if (widgetDef.popoutBounds)
      preferredBounds = widgetDef.popoutBounds;
    if (size)
      preferredBounds = preferredBounds.setSize(size);
    if (point)
      preferredBounds = preferredBounds.setPosition(point);

    const state = popoutWidgetToChildWindow(this.nineZoneState, widgetId, preferredBounds);
    this.nineZoneState = state;

    // now that the state is updated get the id of the container that houses the widgetTab/widgetId
    location = getTabLocation(state, widgetId);
    assert(!!location && isPopoutTabLocation(location));

    const widgetContainerId = location.widgetId;
    const popoutWidget = state.popoutWidgets.byId[widgetContainerId];
    const bounds = Rectangle.create(popoutWidget.bounds);

    setTimeout(() => {
      const popoutContent = (<PopoutWidget widgetContainerId={widgetContainerId} widgetDef={widgetDef} />);
      const position: ChildWindowLocationProps = {
        width: bounds.getWidth(),
        height: bounds.getHeight(),
        left: bounds.left,
        top: bounds.top,
      };
      UiFramework.childWindowManager.openChildWindow(widgetContainerId, widgetDef.label, popoutContent, position, UiFramework.useDefaultPopoutUrl);
    });
  }

  public get isStageClosing() {
    return this._isStageClosing;
  }

  public get isApplicationClosing() {
    return this._isApplicationClosing;
  }

  public get isReady() {
    return this._isReady;
  }

  /** @internal */
  public saveChildWindowSizeAndPosition(childWindowId: string, childWindow: Window) {
    if (!this.nineZoneState)
      return;

    const location = getWidgetLocation(this.nineZoneState, childWindowId);
    if (!location || !isPopoutWidgetLocation(location))
      return;

    const widget = this.nineZoneState.widgets[location.popoutWidgetId];
    const tabId = widget.tabs[0];
    const widgetDef = this.findWidgetDef(tabId);
    if (!widgetDef)
      return;

    const adjustmentWidth = ProcessDetector.isElectronAppFrontend ? 16 : 0;
    const adjustmentHeight = ProcessDetector.isElectronAppFrontend ? 39 : 0;

    const width = childWindow.innerWidth + adjustmentWidth;
    const height = childWindow.innerHeight + adjustmentHeight;
    const bounds = Rectangle.createFromSize({ width, height }).offset({ x: childWindow.screenX, y: childWindow.screenY });
    widgetDef.popoutBounds = bounds;
  }

  /** @internal */
  public setFloatingWidgetBoundsInternal(floatingWidgetId: string, bounds: RectangleProps, inhibitNineZoneStateChangedEvent = false) {
    // istanbul ignore else
    if (this.nineZoneState) {
      const newState = setFloatingWidgetContainerBounds(this.nineZoneState, floatingWidgetId, bounds);
      if (inhibitNineZoneStateChangedEvent)
        this._nineZoneState = newState; // set without triggering new render
      else
        this.nineZoneState = newState;
    }
  }

  /** Method used to possibly change a Popout Widget back to a docked widget if the user was the one closing the popout's child
   * window (i.e. UiFramework.childWindowManager.isClosingChildWindow === false).
   *  @internal
   */
  public dockPopoutWidgetContainer(widgetContainerId: string) {
    if (!this.nineZoneState)
      return;

    // Make sure the widgetContainerId is still in popout state. We don't want to set it to docked if the window is being closed because
    // an API call has moved the widget from a popout state to a floating state.
    // istanbul ignore else
    const location = getWidgetLocation(this.nineZoneState, widgetContainerId);
    if (!location || !isPopoutWidgetLocation(location))
      return;

    const state = dockWidgetContainer(this.nineZoneState, widgetContainerId, true);
    this.nineZoneState = state;
  }

  /** Finds the container with the specified widget and re-docks all widgets
   * back to the panel zone location that was used when the floating container
   * was generated. Supported only when in UI 2.0 or higher.
   * @param widgetId  case sensitive Widget Id.
   * @beta
   */
  public dockWidgetContainer(widgetId: string) {
    // istanbul ignore else
    if (this.nineZoneState) {
      const location = getTabLocation(this.nineZoneState, widgetId);
      if (location) {
        const widgetContainerId = location.widgetId;
        const state = dockWidgetContainer(this.nineZoneState, widgetContainerId, true);
        state && (this.nineZoneState = state);
        if (isPopoutTabLocation(location)) {
          UiFramework.childWindowManager.closeChildWindow(location.widgetId, true);
        }
      }
    }
  }

  public setFloatingWidgetContainerBounds(floatingWidgetId: string, bounds: RectangleProps) {
    if (!this.nineZoneState || !(floatingWidgetId in this.nineZoneState.floatingWidgets.byId))
      return false;

    this.setFloatingWidgetBoundsInternal(floatingWidgetId, bounds);
    return true;
  }

  public getFloatingWidgetContainerIds(): string[] {
    if (!this.nineZoneState)
      return [];

    return [...this.nineZoneState.floatingWidgets.allIds];
  }

  public getFloatingWidgetContainerIdByWidgetId(widgetId: string): string | undefined {
    if (!this.nineZoneState)
      return undefined;

    const location = getTabLocation(this.nineZoneState, widgetId);
    // istanbul ignore else
    if (location && isFloatingTabLocation(location)) {
      return location.floatingWidgetId;
    }
    // istanbul ignore next
    return undefined;
  }

  public getFloatingWidgetContainerBounds(floatingWidgetId: string | undefined) {
    if (!floatingWidgetId)
      return undefined;

    // istanbul ignore else
    if (this.nineZoneState && (floatingWidgetId in this.nineZoneState.floatingWidgets.byId)) {
      const foundWidget = document.querySelector(`div.nz-widget-floatingWidget[data-widget-id='${floatingWidgetId}']`);
      // istanbul ignore next
      if (foundWidget) {
        const domRect = foundWidget.getBoundingClientRect();
        return { left: domRect.left, right: domRect.right, top: domRect.top, bottom: domRect.bottom };
      }
      return this.nineZoneState.floatingWidgets.byId[floatingWidgetId].bounds;
    }
    return undefined;
  }

  private *_widgetDefs(): Iterator<WidgetDef> {
    for (const zoneDef of this.zoneDefs) {
      for (const widgetDef of zoneDef.widgetDefs) {
        yield widgetDef;
      }
    }
    for (const panelDef of this.panelDefs) {
      for (const widgetDef of panelDef.widgetDefs) {
        yield widgetDef;
      }
    }

    return undefined;
  }

  /** Iterable of all widget definitions in a frontstage.
   * @internal
   */
  public get widgetDefs() {
    const defs = this._widgetDefs();
    return {
      [Symbol.iterator]() {
        return defs;
      },
    };
  }
}

function toFrontstageProps(config: FrontstageConfig): FrontstageProps {
  const { contentManipulation, viewNavigation, toolSettings, statusBar, topPanel, leftPanel, bottomPanel, rightPanel, ...other } = config;
  const props: FrontstageProps = {
    ...other,
    defaultTool: CoreTools.selectElementCommand,
    toolSettings: toolSettings ? toZoneElement(toolSettings) : undefined,
    statusBar: statusBar ? toZoneElement(statusBar) : undefined,
    contentManipulationTools: contentManipulation ? toZoneElement(contentManipulation) : undefined,
    viewNavigationTools: viewNavigation ? toZoneElement(viewNavigation) : undefined,
    topPanel: topPanel ? toStagePanelElement(topPanel) : undefined,
    leftPanel: leftPanel ? toStagePanelElement(leftPanel) : undefined,
    bottomPanel: bottomPanel ? toStagePanelElement(bottomPanel) : undefined,
    rightPanel: rightPanel ? toStagePanelElement(rightPanel) : undefined,
  };
  return props;
}

function toWidgetElement(config: WidgetConfig): React.ReactElement<WidgetProps> {
  return (
    <Widget key={config.id} {...config} />
  );
}

function toZoneElement(config: WidgetConfig): React.ReactElement<ZoneProps> {
  return (
    <Zone widgets={[
      toWidgetElement(config),
    ]} />
  );
}

function toStagePanelElement(config: StagePanelConfig): React.ReactElement<StagePanelProps> {
  const { sections, ...other } = config;
  const startWidgets = sections?.start?.map((widget) => toWidgetElement(widget));
  const endWidgets = sections?.end?.map((widget) => toWidgetElement(widget));
  const panelZones: StagePanelZonesProps = {};
  if (startWidgets)
    panelZones.start = {
      widgets: startWidgets,
    };
  if (endWidgets)
    panelZones.end = {
      widgets: endWidgets,
    };
  return (
    <StagePanel
      panelZones={panelZones}
      {...other}
    />
  );
}

let widgetConfigId = 0;
function toWidgetConfig(widget: React.ReactElement<WidgetProps>): WidgetConfig {
  const props = widget.props;
  return {
    ...props,
    id: props.id ? props.id : `widget-config-${++widgetConfigId}`,
  };
}

function toWidgetConfigFromZone(zone: React.ReactElement<ZoneProps>): WidgetConfig | undefined {
  const widgets = zone.props.widgets;
  if (!widgets || widgets.length === 0)
    return undefined;
  const widget = widgets[0];
  return toWidgetConfig(widget);
}

function toPanelConfig(panel: React.ReactElement<StagePanelProps>) {
  const props = panel.props;
  const { panelZones, ...other } = props;
  const start = panelZones?.start?.widgets?.map((w) => toWidgetConfig(w));
  const end = panelZones?.end?.widgets?.map((w) => toWidgetConfig(w));
  const config: StagePanelConfig = {
    ...other,
    sections: {
      start,
      end,
    },
  };
  return config;
}

function toFrontstageConfig(props: FrontstageProps) {
  const { contentManipulationTools, viewNavigationTools, toolSettings, statusBar, topPanel, leftPanel, bottomPanel, rightPanel, ...other } = props;
  const config: FrontstageConfig = {
    ...other,
    version: props.version || 0,
    contentManipulation: contentManipulationTools ? toWidgetConfigFromZone(contentManipulationTools) : undefined,
    viewNavigation: viewNavigationTools ? toWidgetConfigFromZone(viewNavigationTools) : undefined,
    toolSettings: toolSettings ? toWidgetConfigFromZone(toolSettings) : undefined,
    statusBar: statusBar ? toWidgetConfigFromZone(statusBar) : undefined,
    topPanel: topPanel ? toPanelConfig(topPanel) : undefined,
    leftPanel: leftPanel ? toPanelConfig(leftPanel) : undefined,
    bottomPanel: bottomPanel ? toPanelConfig(bottomPanel) : undefined,
    rightPanel: rightPanel ? toPanelConfig(rightPanel) : undefined,
  };
  return config;
}
