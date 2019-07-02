/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { Logger } from "@bentley/bentleyjs-core";
import { UiFramework } from "../UiFramework";
import {
  ResizeHandle, NineZone, NineZoneManagerProps, WidgetZoneIndex,
  PointProps, DefaultStateManager as NineZoneStateManager, RectangleProps, TargetType, Rectangle, getDefaultZonesManagerProps, getDefaultNineZoneStagePanelsManagerProps, StagePanelType, StagePanelsManager,
} from "@bentley/ui-ninezone";
import { StagePanelLocation, getNestedStagePanelKey } from "../stagepanels/StagePanel";
import { WidgetDef, WidgetState } from "../widgets/WidgetDef";
import { ZoneDef, ZoneState } from "../zones/ZoneDef";
import { FrontstageDef } from "./FrontstageDef";
import { FrontstageManager, FrontstageActivatedEventArgs, ModalFrontstageInfo, ModalFrontstageChangedEventArgs } from "./FrontstageManager";
import { ModalFrontstage } from "./ModalFrontstage";

/** Interface defining callbacks for widget changes
 * @public
 */
export interface WidgetChangeHandler {
  handleResize(zoneId: WidgetZoneIndex, x: number, y: number, handle: ResizeHandle, filledHeightDiff: number): void;
  handleTabClick(widgetId: WidgetZoneIndex, tabIndex: number): void;
  handleTabDragStart(widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, widgetBounds: RectangleProps): void;
  handleTabDragEnd(): void;
  handleTabDrag(dragged: PointProps): void;
  handleWidgetStateChange(widgetId: number, tabIndex: number, isOpening: boolean): void;
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
  handleTargetChanged(zoneId: WidgetZoneIndex, type: TargetType, isTargeted: boolean): void;
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
  zoneDefProvider: ZoneDefProvider;
}

/** State for the FrontstageComposer component.
 * @internal
 */
interface FrontstageComposerState {
  frontstageId: string;
  modalFrontstageCount: number;
  nineZone: NineZoneManagerProps;
}

/** FrontstageComposer React component.
 * @public
 */
export class FrontstageComposer extends React.Component<CommonProps, FrontstageComposerState>
  implements WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider, StagePanelChangeHandler, NineZoneChangeHandler {

  private _frontstageDef: FrontstageDef | undefined;

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
    };
  }

  private determineNineZoneProps(frontstageDef?: FrontstageDef): NineZoneManagerProps {
    let nineZone: NineZoneManagerProps;
    if (frontstageDef && frontstageDef.nineZone)
      nineZone = { ...frontstageDef.nineZone };
    else {
      const isInFooterMode = frontstageDef ? frontstageDef.isInFooterMode : false;
      nineZone = {
        zones: NineZoneStateManager.setIsInFooterMode(isInFooterMode, getDefaultZonesManagerProps()),
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

  private _handleFrontstageActivatedEvent = (args: FrontstageActivatedEventArgs) => {
    // Save the nineZoneProps into the former FrontstageDef
    if (this._frontstageDef)
      this._frontstageDef.nineZone = { ...this.state.nineZone };

    this._frontstageDef = args.activatedFrontstageDef;

    const frontstageId = this._frontstageDef.id;
    const nineZone = this.determineNineZoneProps(this._frontstageDef);
    const needInitialLayout = (this._frontstageDef && this._frontstageDef.nineZone) ? false : true;

    // Get the id and nineZoneProps for the current FrontstageDef
    this.setState({
      frontstageId,
      nineZone,
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
    const zones = Object.keys(nineZone.zones.zones);
    zones
      .map((key) => Number(key) as WidgetZoneIndex)
      .forEach((zoneId: WidgetZoneIndex) => {
        const zoneDef = this.getZoneDef(zoneId);
        if (!zoneDef || zoneDef.zoneState !== ZoneState.Open)
          return;

        if (!zoneDef.allowsMerging)
          this.setZoneAllowsMerging(zoneId, false);

        if (zoneDef.mergeWithZone)
          this.mergeZones(zoneId, zoneDef.mergeWithZone);

        const zoneProps = nineZone.zones.zones[zoneId];
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
    this.setState((_prevState) => {
      return {
        modalFrontstageCount: FrontstageManager.modalFrontstageCount,
      };
    });
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

  // <InputFieldMessage target={inputMessageParent} children={inputMessageText}
  //  onClose={() => { this.setState((_prevState) => ({ isInputFieldMessageVisible: false })); }} /> : null

  public componentDidMount(): void {
    this.layout();
    window.addEventListener("resize", this._handleWindowResize, true);
    FrontstageManager.onFrontstageActivatedEvent.addListener(this._handleFrontstageActivatedEvent);
    FrontstageManager.onModalFrontstageChangedEvent.addListener(this._handleModalFrontstageChangedEvent);
  }

  public componentWillUnmount(): void {
    window.removeEventListener("resize", this._handleWindowResize, true);
    FrontstageManager.onFrontstageActivatedEvent.removeListener(this._handleFrontstageActivatedEvent);
    FrontstageManager.onModalFrontstageChangedEvent.removeListener(this._handleModalFrontstageChangedEvent);
  }

  private _handleWindowResize = () => {
    this.layout();
  }

  public handleResize = (zoneId: WidgetZoneIndex, x: number, y: number, handle: ResizeHandle, filledHeightDiff: number) => {
    this.setState((prevState) => {
      const zones = FrontstageManager.NineZoneManager.getZonesManager().handleResize(zoneId, x, y, handle, filledHeightDiff, prevState.nineZone.zones);
      return {
        nineZone: {
          ...prevState.nineZone,
          zones,
        },
      };
    });
  }

  public handleTabClick = (widgetId: WidgetZoneIndex, tabIndex: number) => {
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
        const nineZone = new NineZone(this.state.nineZone.zones);
        const widget = nineZone.getWidget(widgetId);
        const widgets = widget.zone ? widget.zone.getWidgets() : [widget];
        widgets.forEach((w) => {
          const zoneDef = this.getZoneDef(w.props.id);
          if (!zoneDef)
            return;

          const visibleWidgets = zoneDef.widgetDefs.filter((wd) => wd.isVisible);
          for (let i = 0; i < visibleWidgets.length; i++) {
            const widgetDef = visibleWidgets[i];
            let state = widgetDef.state;
            if (w.props.tabIndex === i)
              state = WidgetState.Open;
            else if (state === WidgetState.Open)
              state = WidgetState.Closed;
            widgetDef.setWidgetState(state);
          }
        });
      },
    );
  }

  public handleTabDragStart = (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, widgetBounds: RectangleProps) => {
    this.setState((prevState) => {
      const nineZone = FrontstageManager.NineZoneManager.handleWidgetTabDragStart({ widgetId, tabId, initialPosition, widgetBounds }, prevState.nineZone);
      return {
        nineZone,
      };
    });
  }

  public handleTabDragEnd = () => {
    this.setState((prevState) => {
      const nineZone = FrontstageManager.NineZoneManager.handleWidgetTabDragEnd(prevState.nineZone);
      return {
        nineZone,
      };
    });
  }

  public handleTabDrag = (dragged: PointProps) => {
    this.setState((prevState) => {
      const zones = FrontstageManager.NineZoneManager.getZonesManager().handleWidgetTabDrag(dragged, prevState.nineZone.zones);
      return {
        nineZone: {
          ...prevState.nineZone,
          zones,
        },
      };
    });
  }

  public handleTargetChanged(zoneId: WidgetZoneIndex, type: TargetType, isTargeted: boolean): void {
    this.setState((prevState) => {
      const zones = isTargeted ? FrontstageManager.NineZoneManager.getZonesManager().handleTargetChanged({ zoneId, type }, prevState.nineZone.zones) :
        FrontstageManager.NineZoneManager.getZonesManager().handleTargetChanged(undefined, prevState.nineZone.zones);
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
    this.setState((prevState) => {
      const nested = FrontstageManager.NineZoneManager.getNestedPanelsManager().setSize(panel, size, prevState.nineZone.nested);
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
    this.setState((prevState) => {
      const nested = FrontstageManager.NineZoneManager.getNestedPanelsManager().resize(panel, resizeBy, prevState.nineZone.nested);
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
    const panelKey = getNestedStagePanelKey(panelLocation);
    this.setState((prevState) => {
      const prevPanels = prevState.nineZone.nested.panels[panelKey.id];
      const prevPanel = StagePanelsManager.getPanel(panelKey.type, prevPanels);
      const nested = FrontstageManager.NineZoneManager.getNestedPanelsManager().setIsCollapsed(panelKey, !prevPanel.isCollapsed, prevState.nineZone.nested);
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

  public handleZonesBoundsChange(bounds: RectangleProps): void {
    this.setState((prevState) => {
      const zones = FrontstageManager.NineZoneManager.getZonesManager().layout(bounds, prevState.nineZone.zones);
      return {
        nineZone: {
          ...prevState.nineZone,
          zones,
        },
      };
    });
  }

  public handleWidgetStateChange(widgetId: WidgetZoneIndex, tabIndex: number, isOpening: boolean): void {
    this.setState((prevState) => {
      const zones = FrontstageManager.NineZoneManager.getZonesManager().handleWidgetStateChange(widgetId, tabIndex, isOpening, prevState.nineZone.zones);
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

  public getZoneDef(zoneId: number): ZoneDef | undefined {
    if (!this._frontstageDef) {
      Logger.logError(UiFramework.loggerCategory(this), "getZoneDef: There is no active frontstage");
      return undefined;
    }

    const zoneDef = this._frontstageDef.getZoneDef(zoneId);

    // Zones can be undefined in a Frontstage

    return zoneDef;
  }

  public getGhostOutlineBounds(zoneId: WidgetZoneIndex): RectangleProps | undefined {
    const nineZone = new NineZone(this.state.nineZone.zones);
    return nineZone.getWidgetZone(zoneId).getGhostOutlineBounds();
  }

  public setZoneAllowsMerging(zoneId: WidgetZoneIndex, allowsMerging: boolean): void {
    this.setState((prevState) => {
      const zones = FrontstageManager.NineZoneManager.getZonesManager().setAllowsMerging(zoneId, allowsMerging, prevState.nineZone.zones);
      return {
        nineZone: {
          ...prevState.nineZone,
          zones,
        },
      };
    });
  }

  public mergeZones(toMergeId: WidgetZoneIndex, targetId: WidgetZoneIndex): void {
    this.setState((prevState) => {
      const zones = FrontstageManager.NineZoneManager.getZonesManager().mergeZone(toMergeId, targetId, prevState.nineZone.zones);
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
}
