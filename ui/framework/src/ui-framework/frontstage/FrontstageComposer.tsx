/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";
import { CommonProps, PointProps, Rectangle, RectangleProps, BadgeUtilities } from "@bentley/ui-core";
import { Logger } from "@bentley/bentleyjs-core";
import { UiFramework } from "../UiFramework";
import {
  ResizeHandle, NineZoneManagerProps, WidgetZoneId, ZoneTargetType, getDefaultZonesManagerProps,
  getDefaultNineZoneStagePanelsManagerProps, StagePanelType, widgetZoneIds,
} from "@bentley/ui-ninezone";
import { StagePanelLocation, getNestedStagePanelKey } from "../stagepanels/StagePanel";
import { WidgetDef, WidgetState } from "../widgets/WidgetDef";
import { ZoneDef, ZoneState } from "../zones/ZoneDef";
import { FrontstageDef } from "./FrontstageDef";
import { FrontstageManager, FrontstageActivatedEventArgs, ModalFrontstageInfo, ModalFrontstageChangedEventArgs } from "./FrontstageManager";
import { ModalFrontstage } from "./ModalFrontstage";
import { WidgetTabs, WidgetTab } from "../widgets/WidgetStack";
import { PanelStateChangedEventArgs, StagePanelState } from "../stagepanels/StagePanelDef";

/** Interface defining callbacks for widget changes
 * @public
 */
export interface WidgetChangeHandler {
  handleResize(zoneId: WidgetZoneId, resizeBy: number, handle: ResizeHandle, filledHeightDiff: number): void;
  handleTabClick(widgetId: WidgetZoneId, tabIndex: number): void;
  handleTabDragStart(widgetId: WidgetZoneId, tabIndex: number, initialPosition: PointProps, widgetBounds: RectangleProps): void;
  handleTabDragEnd(): void;
  handleTabDrag(dragged: PointProps): void;
  handleWidgetStateChange(widgetId: WidgetZoneId, tabIndex: number, isOpening: boolean): void;
}

/** Interface defining callbacks for stage panel changes
 * @public
 */
export interface StagePanelChangeHandler {
  /** @alpha */
  handlePanelInitialize(panelLocation: StagePanelLocation, size: number): void;
  /** @alpha */
  handlePanelResize(panelLocation: StagePanelLocation, resizeBy: number): void;
  /** @alpha */
  handlePanelPaneTargetChange(panelLocation: StagePanelLocation, paneIndex: number | undefined): void;
  /** @alpha */
  handlePanelTargetChange(panelLocation: StagePanelLocation | undefined): void;
  /** @alpha */
  handleTogglePanelCollapse(panelLocation: StagePanelLocation): void;
}

/** Interface defining callbacks for ZoneDropTarget changes
 * @public
 */
export interface TargetChangeHandler {
  handleTargetChanged(zoneId: WidgetZoneId, type: ZoneTargetType, isTargeted: boolean): void;
}

/** Interface defining callbacks for nine zone changes
 * @public
 */
export interface NineZoneChangeHandler {
  handleZonesBoundsChange(bounds: RectangleProps): void;
}

/** Interface defining a provider for Zone definitions
 * @public
 */
export interface ZoneDefProvider {
  getZoneDef(zoneId: number): ZoneDef | undefined;
}

/** Runtime Props for the Frontstage
 * @internal
 */
export interface FrontstageRuntimeProps {
  frontstageDef: FrontstageDef;
  nineZone: NineZoneManagerProps;
  nineZoneChangeHandler: NineZoneChangeHandler;
  stagePanelChangeHandler: StagePanelChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  widgetChangeHandler: WidgetChangeHandler;
  widgetTabs: WidgetTabs;
  zoneDefProvider: ZoneDefProvider;
}

/** State for the FrontstageComposer component.
 * @internal
 */
interface FrontstageComposerState {
  frontstageId: string;
  modalFrontstageCount: number;
  nineZone: NineZoneManagerProps;
  widgetTabs: WidgetTabs;
}

const getDefaultWidgetTabs = (): WidgetTabs => ({
  [1]: [],
  [2]: [],
  [3]: [],
  [4]: [],
  [6]: [],
  [7]: [],
  [8]: [],
  [9]: [],
});

/** FrontstageComposer React component.
 * @public
 */
export class FrontstageComposer extends React.Component<CommonProps, FrontstageComposerState>
  implements WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider, StagePanelChangeHandler, NineZoneChangeHandler {

  private _frontstageDef: FrontstageDef | undefined;
  private _isMounted = false;

  /** @internal */
  public readonly state: Readonly<FrontstageComposerState>;

  constructor(props: CommonProps) {
    super(props);

    const activeFrontstageId = FrontstageManager.activeFrontstageId;
    this._frontstageDef = FrontstageManager.findFrontstageDef(activeFrontstageId);

    const nineZone = this.determineNineZoneProps(this._frontstageDef);
    this.state = {
      nineZone,
      frontstageId: activeFrontstageId,
      modalFrontstageCount: FrontstageManager.modalFrontstageCount,
      widgetTabs: getDefaultWidgetTabs(),
    };
  }

  private determineNineZoneProps(frontstageDef?: FrontstageDef): NineZoneManagerProps {
    let nineZone: NineZoneManagerProps;
    if (frontstageDef && frontstageDef.nineZone)
      nineZone = { ...frontstageDef.nineZone };
    else {
      const isInFooterMode = frontstageDef ? frontstageDef.isInFooterMode : false;
      nineZone = {
        zones: FrontstageManager.NineZoneManager.getZonesManager().setIsInFooterMode(isInFooterMode, getDefaultZonesManagerProps()),
        nested: {
          panels: {
            inner: getDefaultNineZoneStagePanelsManagerProps(),
            outer: getDefaultNineZoneStagePanelsManagerProps(),
          },
        },
      };
    }
    return nineZone;
  }

  private determineWidgetTabs(): WidgetTabs {
    const defaultWidgetTabs = getDefaultWidgetTabs();
    const widgetTabs = widgetZoneIds.reduce((acc, zoneId) => {
      const zoneDef = this.getZoneDef(zoneId);
      if (!zoneDef)
        return acc;
      const visibleWidgetDefs = zoneDef.widgetDefs.filter((widgetDef: WidgetDef) => {
        return widgetDef.isVisible && !widgetDef.isFloating;
      });
      const tabs = visibleWidgetDefs.map<WidgetTab>((widgetDef: WidgetDef) => ({
        badgeType: BadgeUtilities.determineBadgeType(widgetDef.badgeType, widgetDef.betaBadge), // tslint:disable-line: deprecation
        iconSpec: widgetDef.iconSpec,
        title: widgetDef.label,
        widgetName: widgetDef.id,
      }));
      return {
        ...acc,
        [zoneId]: tabs,
      };
    }, defaultWidgetTabs);
    return widgetTabs;
  }

  private _handleFrontstageActivatedEvent = (args: FrontstageActivatedEventArgs) => {
    // Save the nineZoneProps into the former FrontstageDef
    if (this._frontstageDef)
      this._frontstageDef.nineZone = { ...this.state.nineZone };

    this._frontstageDef = args.activatedFrontstageDef;

    // Get the id and nineZoneProps for the current FrontstageDef
    const frontstageId = this._frontstageDef.id;
    const nineZone = this.determineNineZoneProps(this._frontstageDef);
    const needInitialLayout = (this._frontstageDef && this._frontstageDef.nineZone) ? false : true;
    const widgetTabs = this.determineWidgetTabs();

    // istanbul ignore else
    if (this._isMounted)
      this.setState({
        frontstageId,
        nineZone,
        widgetTabs,
      }, () => {
        if (needInitialLayout)
          this.initializeFrontstageLayout(nineZone);
        this.layout();
      });
  }

  private initializeFrontstageLayout(nineZone: NineZoneManagerProps) {
    const nestedPanelsManager = FrontstageManager.NineZoneManager.getNestedPanelsManager();
    nestedPanelsManager.getPanelsManager("inner").getPanelManager(StagePanelType.Top).minSize = 20;
    nestedPanelsManager.getPanelsManager("inner").getPanelManager(StagePanelType.Top).collapseOffset = 0;
    nestedPanelsManager.getPanelsManager("inner").getPanelManager(StagePanelType.Bottom).minSize = 20;
    nestedPanelsManager.getPanelsManager("inner").getPanelManager(StagePanelType.Bottom).collapseOffset = 0;
    nestedPanelsManager.getPanelsManager("outer").getPanelManager(StagePanelType.Top).minSize = 20;
    nestedPanelsManager.getPanelsManager("outer").getPanelManager(StagePanelType.Top).collapseOffset = 0;
    nestedPanelsManager.getPanelsManager("outer").getPanelManager(StagePanelType.Bottom).minSize = 20;
    nestedPanelsManager.getPanelsManager("outer").getPanelManager(StagePanelType.Bottom).collapseOffset = 0;

    widgetZoneIds.forEach((zoneId: WidgetZoneId) => {
      const zoneDef = this.getZoneDef(zoneId);
      if (!zoneDef || zoneDef.zoneState === ZoneState.Off)
        return;

      if (!zoneDef.allowsMerging)
        this.setZoneAllowsMerging(zoneId, false);

      if (zoneDef.mergeWithZone)
        this.mergeZones(zoneId, zoneDef.mergeWithZone);

      const zoneProps = nineZone.zones.zones[zoneId];
      // istanbul ignore else
      if (zoneProps.widgets.length >= 1) {
        zoneProps.widgets.forEach((widgetId) => {
          zoneDef.widgetDefs
            .filter((widgetDef: WidgetDef) => {
              return widgetDef.isVisible && !widgetDef.isToolSettings && !widgetDef.isStatusBar && !widgetDef.isFreeform;
            })
            .forEach((widgetDef: WidgetDef, tabIndex: number) => {
              if (widgetDef.canOpen()) {
                this.handleWidgetStateChange(widgetId, tabIndex, true);
              }
            });
        });
      }
    });
  }

  private _handleModalFrontstageChangedEvent = (_args: ModalFrontstageChangedEventArgs) => {
    // istanbul ignore else
    if (this._isMounted)
      this.setState({ modalFrontstageCount: FrontstageManager.modalFrontstageCount });
  }

  private _navigationBack = () => {
  }

  private _closeModal = () => {
    FrontstageManager.closeModalFrontstage();
  }

  private renderModalFrontstage(): React.ReactNode {
    const activeModalFrontstage: ModalFrontstageInfo | undefined = FrontstageManager.activeModalFrontstage;
    if (!activeModalFrontstage)
      return null;

    const { title, content, appBarRight } = activeModalFrontstage;

    return (
      <ModalFrontstage
        isOpen={true}
        title={title}
        navigateBack={this._navigationBack}
        closeModal={this._closeModal}
        appBarRight={appBarRight}
      >
        {content}
      </ModalFrontstage>
    );
  }

  public render(): React.ReactNode {
    let content: React.ReactNode;
    if (this._frontstageDef) {
      if (this._frontstageDef.frontstageProvider) {
        const frontstageRuntimeProps: FrontstageRuntimeProps = {
          frontstageDef: this._frontstageDef,
          nineZone: this.state.nineZone,
          nineZoneChangeHandler: this,
          stagePanelChangeHandler: this,
          widgetChangeHandler: this,
          widgetTabs: this.state.widgetTabs,
          targetChangeHandler: this,
          zoneDefProvider: this,
        };
        content = React.cloneElement(this._frontstageDef.frontstageProvider.frontstage, { runtimeProps: frontstageRuntimeProps });
      } else {
        Logger.logError(UiFramework.loggerCategory(this), "FrontstageDef has no FrontstageProvider");
        content = null;
      }
    }

    return (
      <div id="uifw-frontstage-composer" className={this.props.className} style={this.props.style}>
        {this.renderModalFrontstage()}
        {content}
      </div>
    );
  }

  public componentDidMount(): void {
    this._isMounted = true;
    this.layout();
    window.addEventListener("resize", this._handleWindowResize, true);
    FrontstageManager.onFrontstageActivatedEvent.addListener(this._handleFrontstageActivatedEvent);
    FrontstageManager.onModalFrontstageChangedEvent.addListener(this._handleModalFrontstageChangedEvent);
    FrontstageManager.onWidgetStateChangedEvent.addListener(this._handleWidgetStateChangedEvent);
    FrontstageManager.onPanelStateChangedEvent.addListener(this._handlePanelStateChangedEvent);
    FrontstageManager.onToolActivatedEvent.addListener(this._handleToolActivatedEvent);
  }

  public componentWillUnmount(): void {
    this._isMounted = false;
    window.removeEventListener("resize", this._handleWindowResize, true);
    FrontstageManager.onFrontstageActivatedEvent.removeListener(this._handleFrontstageActivatedEvent);
    FrontstageManager.onModalFrontstageChangedEvent.removeListener(this._handleModalFrontstageChangedEvent);
    FrontstageManager.onPanelStateChangedEvent.removeListener(this._handlePanelStateChangedEvent);
  }

  private _handleWindowResize = () => {
    this.layout();
  }

  public handleResize = (zoneId: WidgetZoneId, resizeBy: number, handle: ResizeHandle, filledHeightDiff: number) => {
    // istanbul ignore else
    if (this._isMounted)
      this.setState((prevState) => {
        const zones = FrontstageManager.NineZoneManager.getZonesManager().handleWidgetResize({ zoneId, resizeBy, handle, filledHeightDiff }, prevState.nineZone.zones);
        if (zones === prevState.nineZone.zones)
          return null;
        return {
          nineZone: {
            ...prevState.nineZone,
            zones,
          },
        };
      });
  }

  public handleTabClick = (widgetId: WidgetZoneId, tabIndex: number) => {
    // istanbul ignore else
    if (this._isMounted)
      this.setState((prevState) => {
        const nineZone = FrontstageManager.NineZoneManager.handleWidgetTabClick(widgetId, tabIndex, prevState.nineZone);
        if (nineZone === prevState.nineZone)
          return null;
        return {
          nineZone,
        };
      },
        () => {
          // TODO: use NineZoneManager notifications once available
          const manager = FrontstageManager.NineZoneManager.getZonesManager();
          const props = this.state.nineZone.zones;
          const zone = manager.findZoneWithWidget(widgetId, props);
          const widgets = zone ? zone.widgets : [widgetId];
          widgets.forEach((wId) => {
            const zoneDef = this.getZoneDef(wId);
            if (!zoneDef)
              return;

            const w = props.widgets[wId];
            const visibleWidgets = zoneDef.widgetDefs.filter((wd) => wd.isVisible);
            for (let i = 0; i < visibleWidgets.length; i++) {
              const widgetDef = visibleWidgets[i];
              let state = widgetDef.state;
              if (w.tabIndex === i)
                state = WidgetState.Open;
              else if (state === WidgetState.Open)
                state = WidgetState.Closed;
              widgetDef.setWidgetState(state);
            }
          });
        },
      );
  }

  public handleTabDragStart = (widgetId: WidgetZoneId, tabIndex: number, initialPosition: PointProps, widgetBounds: RectangleProps) => {
    // istanbul ignore else
    if (this._isMounted)
      this.setState((prevState) => {
        const nineZone = FrontstageManager.NineZoneManager.handleWidgetTabDragStart({ widgetId, tabIndex, initialPosition, widgetBounds }, prevState.nineZone);
        if (nineZone === prevState.nineZone)
          return null;
        return {
          nineZone,
        };
      });
  }

  public handleTabDragEnd = () => {
    // istanbul ignore else
    if (this._isMounted)
      this.setState((prevState) => {
        const nineZone = FrontstageManager.NineZoneManager.handleWidgetTabDragEnd(prevState.nineZone);
        if (nineZone === prevState.nineZone)
          return null;
        return {
          nineZone,
        };
      });
  }

  public handleTabDrag = (dragged: PointProps) => {
    // istanbul ignore else
    if (this._isMounted)
      this.setState((prevState) => {
        const zones = FrontstageManager.NineZoneManager.getZonesManager().handleWidgetTabDrag(dragged, prevState.nineZone.zones);
        if (zones === prevState.nineZone.zones)
          return null;
        return {
          nineZone: {
            ...prevState.nineZone,
            zones,
          },
        };
      });
  }

  public handleTargetChanged(zoneId: WidgetZoneId, type: ZoneTargetType, isTargeted: boolean): void {
    // istanbul ignore else
    if (this._isMounted)
      this.setState((prevState) => {
        const zones = isTargeted ? FrontstageManager.NineZoneManager.getZonesManager().handleTargetChanged({ zoneId, type }, prevState.nineZone.zones) :
          FrontstageManager.NineZoneManager.getZonesManager().handleTargetChanged(undefined, prevState.nineZone.zones);
        if (zones === prevState.nineZone.zones)
          return null;
        return {
          nineZone: {
            ...prevState.nineZone,
            zones,
          },
        };
      });
  }

  /** @alpha */
  public handlePanelInitialize(panelLocation: StagePanelLocation, size: number): void {
    const panel = getNestedStagePanelKey(panelLocation);
    // istanbul ignore else
    if (this._isMounted)
      this.setState((prevState) => {
        const nested = FrontstageManager.NineZoneManager.getNestedPanelsManager().setSize(panel, size, prevState.nineZone.nested);
        if (nested === prevState.nineZone.nested)
          return null;
        return {
          nineZone: {
            ...prevState.nineZone,
            nested,
          },
        };
      });
  }

  /** @alpha */
  public handlePanelResize(panelLocation: StagePanelLocation, resizeBy: number): void {
    const panel = getNestedStagePanelKey(panelLocation);
    // istanbul ignore else
    if (this._isMounted)
      this.setState((prevState) => {
        const nested = FrontstageManager.NineZoneManager.getNestedPanelsManager().resize(panel, resizeBy, prevState.nineZone.nested);
        if (nested === prevState.nineZone.nested)
          return null;
        return {
          nineZone: {
            ...prevState.nineZone,
            nested,
          },
        };
      });
  }

  /** @alpha */
  public handlePanelPaneTargetChange(panelLocation: StagePanelLocation, paneIndex: number | undefined): void {
    const panelKey = getNestedStagePanelKey(panelLocation);
    FrontstageManager.NineZoneManager.setPaneTarget(paneIndex === undefined ? undefined : {
      panelId: panelKey.id,
      panelType: panelKey.type,
      paneIndex,
    });
  }

  /** @alpha */
  public handlePanelTargetChange(panelLocation: StagePanelLocation | undefined): void {
    const panelKey = panelLocation === undefined ? undefined : getNestedStagePanelKey(panelLocation);
    FrontstageManager.NineZoneManager.setPanelTarget(panelKey ? {
      panelId: panelKey.id,
      panelType: panelKey.type,
    } : undefined);
  }

  /** @alpha */
  public handleTogglePanelCollapse(panelLocation: StagePanelLocation): void {
    const frontstage = FrontstageManager.activeFrontstageDef;
    if (!frontstage)
      return;
    const stagePanel = frontstage.getStagePanelDef(panelLocation);
    if (!stagePanel)
      return;
    const isCollapsed = panelStateToIsCollapsed(stagePanel.panelState);
    const panelState = isCollapsed ? StagePanelState.Open : StagePanelState.Minimized;
    stagePanel.panelState = panelState;
  }

  public handleZonesBoundsChange(bounds: RectangleProps): void {
    // istanbul ignore else
    if (this._isMounted)
      this.setState((prevState) => {
        const zones = FrontstageManager.NineZoneManager.getZonesManager().setZonesBounds(bounds, prevState.nineZone.zones);
        if (zones === prevState.nineZone.zones)
          return null;
        return {
          nineZone: {
            ...prevState.nineZone,
            zones,
          },
        };
      });
  }

  public handleWidgetStateChange(widgetId: WidgetZoneId, tabIndex: number, isOpening: boolean): void {
    // istanbul ignore else
    if (this._isMounted)
      this.setState((prevState) => {
        const widget = prevState.nineZone.zones.widgets[widgetId];
        if (isOpening && widget.tabIndex === tabIndex)
          return null;
        if (!isOpening && widget.tabIndex !== tabIndex)
          return null;
        const nineZone = FrontstageManager.NineZoneManager.handleWidgetTabClick(widgetId, tabIndex, prevState.nineZone);
        if (nineZone === prevState.nineZone)
          return null;
        return {
          nineZone,
        };
      });
  }

  public getZoneDef(zoneId: number): ZoneDef | undefined {
    if (!this._frontstageDef) {
      Logger.logError(UiFramework.loggerCategory(this), "getZoneDef: There is no active frontstage");
      return undefined;
    }

    const zoneDef = this._frontstageDef.getZoneDef(zoneId);

    // Zones can be undefined in a Frontstage

    return zoneDef;
  }

  public getGhostOutlineBounds(zoneId: WidgetZoneId): RectangleProps | undefined {
    const manager = FrontstageManager.NineZoneManager.getZonesManager();
    return manager.getGhostOutlineBounds(zoneId, this.state.nineZone.zones);
  }

  public setZoneAllowsMerging(zoneId: WidgetZoneId, allowsMerging: boolean): void {
    // istanbul ignore else
    if (this._isMounted)
      this.setState((prevState) => {
        const zones = FrontstageManager.NineZoneManager.getZonesManager().setAllowsMerging(zoneId, allowsMerging, prevState.nineZone.zones);
        if (zones === prevState.nineZone.zones)
          return null;
        return {
          nineZone: {
            ...prevState.nineZone,
            zones,
          },
        };
      });
  }

  public mergeZones(toMergeId: WidgetZoneId, targetId: WidgetZoneId): void {
    // istanbul ignore else
    if (this._isMounted)
      this.setState((prevState) => {
        const zones = FrontstageManager.NineZoneManager.getZonesManager().mergeZone(toMergeId, targetId, prevState.nineZone.zones);
        if (zones === prevState.nineZone.zones)
          return null;
        return {
          nineZone: {
            ...prevState.nineZone,
            zones,
          },
        };
      });
  }

  private layout() {
    const element = document.getElementById("uifw-ninezone-zones-area");
    if (!element)
      return;
    const bounds = Rectangle.create(element.getBoundingClientRect());
    this.handleZonesBoundsChange(bounds);
  }

  private _handleWidgetStateChangedEvent = () => {
    const widgetTabs = this.determineWidgetTabs();
    // istanbul ignore else
    if (this._isMounted)
      this.setState({
        widgetTabs,
      });
  }

  private _handlePanelStateChangedEvent = ({ panelDef, panelState }: PanelStateChangedEventArgs) => {
    this.setPanelState(panelDef.location, panelState);
  }

  private _handleToolActivatedEvent = () => {
    // istanbul ignore else
    if (this._isMounted)
      this.setState((prevState) => {
        const activeToolSettingsNode = FrontstageManager.activeToolSettingsNode;
        const manager = FrontstageManager.NineZoneManager;
        let nineZone = prevState.nineZone;
        if (activeToolSettingsNode) {
          nineZone = manager.showWidget(2, prevState.nineZone);
        } else {
          nineZone = manager.hideWidget(2, prevState.nineZone);
        }
        if (nineZone === prevState.nineZone)
          return null;
        return {
          nineZone,
        };
      });
  }

  private setPanelState(location: StagePanelLocation, panelState: StagePanelState) {
    const panelKey = getNestedStagePanelKey(location);
    const isCollapsed = panelStateToIsCollapsed(panelState);
    // istanbul ignore else
    if (this._isMounted)
      this.setState((prevState) => {
        const nested = FrontstageManager.NineZoneManager.getNestedPanelsManager().setIsCollapsed(panelKey, isCollapsed, prevState.nineZone.nested);
        if (nested === prevState.nineZone.nested)
          return null;
        return {
          nineZone: {
            ...prevState.nineZone,
            nested,
          },
        };
      });
  }
}

/** @internal */
export const panelStateToIsCollapsed = (panelState: StagePanelState) => {
  switch (panelState) {
    case StagePanelState.Minimized:
    case StagePanelState.Off:
      return true;
    default:
      return false;
  }
};
