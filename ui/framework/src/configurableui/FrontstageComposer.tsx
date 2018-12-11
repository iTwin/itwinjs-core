/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";
import * as ReactDOM from "react-dom";

import { FrontstageManager, FrontstageActivatedEventArgs, ModalFrontstageInfo, ModalFrontstageChangedEventArgs } from "./FrontstageManager";
import { FrontstageDef } from "./FrontstageDef";
import { ZoneDef, ZoneState } from "./ZoneDef";
import { ModalFrontstage } from "./ModalFrontstage";

import {
  ResizeHandle, NineZone, NineZoneProps, getDefaultNineZoneProps, WidgetZoneIndex,
  Size, PointProps, DefaultStateManager as NineZoneStateManager, RectangleProps, TargetType, WidgetProps as NZ_WidgetProps,
} from "@bentley/ui-ninezone";

import { WidgetDef } from "./WidgetDef";

/** Interface defining callbacks for widget changes */
export interface WidgetChangeHandler {
  handleResize(zoneId: number, x: number, y: number, handle: ResizeHandle, filledHeightDiff: number): void;
  handleTabClick(widgetId: number, tabIndex: number): void;
  handleTabDragStart(widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, offset: PointProps): void;
  handleTabDragEnd(): void;
  handleTabDrag(dragged: PointProps): void;
  handleWidgetStateChange(widgetId: number, tabIndex: number, isOpening: boolean): void;
}

/** Interface defining callbacks for ZoneDropTarget changes */
export interface TargetChangeHandler {
  handleTargetChanged(zoneId: WidgetZoneIndex, type: TargetType, isTargeted: boolean): void;
}

/** Interface defining a provider for Zone definitions */
export interface ZoneDefProvider {
  getZoneDef(zoneId: number): ZoneDef | undefined;
}

/** Runtime Props for the Frontstage */
export interface FrontstageRuntimeProps {
  nineZoneProps: NineZoneProps;
  widgetChangeHandler: WidgetChangeHandler;
  targetChangeHandler: TargetChangeHandler;
  zoneDefProvider: ZoneDefProvider;
  frontstageDef: FrontstageDef;
}

/** Properties for the [[FrontstageComposer]] component.
 */
export interface FrontstageComposerProps {
  className?: string;
  style?: React.CSSProperties;
}

/** State for the FrontstageComposer component.
 */
export interface FrontstageComposerState {
  frontstageId: string;
  modalFrontstageCount: number;
  nineZoneProps: NineZoneProps;
}

/** FrontstageComposer React component.
 */
export class FrontstageComposer extends React.Component<FrontstageComposerProps, FrontstageComposerState>
  implements WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider {

  private _frontstageDef: FrontstageDef | undefined;

  /** @hidden */
  public readonly state: Readonly<FrontstageComposerState>;

  constructor(props: FrontstageComposerProps, context?: any) {
    super(props, context);

    const activeFrontstageId = FrontstageManager.activeFrontstageId;
    this._frontstageDef = FrontstageManager.findFrontstageDef(activeFrontstageId);

    const nineZoneProps = this.determineNineZoneProps(this._frontstageDef);
    this.state = {
      nineZoneProps,
      frontstageId: activeFrontstageId,
      modalFrontstageCount: FrontstageManager.modalFrontstageCount,
    };
  }

  private determineNineZoneProps(frontstageDef?: FrontstageDef): NineZoneProps {
    let nineZoneProps: NineZoneProps;

    if (frontstageDef && frontstageDef.nineZoneProps)
      nineZoneProps = { ...frontstageDef.nineZoneProps };
    else {
      const isInFooterMode = frontstageDef ? frontstageDef.isInFooterMode : false;
      nineZoneProps = NineZoneStateManager.setIsInFooterMode(isInFooterMode, getDefaultNineZoneProps());
    }

    return nineZoneProps;
  }

  private _handleFrontstageActivatedEvent = (args: FrontstageActivatedEventArgs) => {
    // Save the nineZoneProps into the former FrontstageDef
    if (this._frontstageDef)
      this._frontstageDef.nineZoneProps = { ...this.state.nineZoneProps };

    this._frontstageDef = args.frontstageDef;

    const frontstageId = args.frontstageId;
    const nineZoneProps = this.determineNineZoneProps(this._frontstageDef);
    const needInitialLayout = (this._frontstageDef && this._frontstageDef.nineZoneProps) ? false : true;

    // Get the id and nineZoneProps for the current FrontstageDef
    this.setState({
      frontstageId,
      nineZoneProps,
    }, () => {
      if (needInitialLayout)
        this.initializeFrontstageLayout(nineZoneProps);
      this.layout();
    });
  }

  private initializeFrontstageLayout(nineZoneProps: NineZoneProps) {
    const zones = Object.keys(nineZoneProps.zones);
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

        const zoneProps = nineZoneProps.zones[zoneId];
        if (zoneProps.widgets.length >= 1) {
          zoneProps.widgets.forEach((widget: NZ_WidgetProps) => {
            zoneDef.widgetDefs
              .filter((widgetDef: WidgetDef) => {
                return widgetDef.isVisible && !widgetDef.isToolSettings && !widgetDef.isStatusBar && !widgetDef.isFreeform;
              })
              .forEach((widgetDef: WidgetDef, tabIndex: number) => {
                if (widgetDef.canOpen()) {
                  this.handleWidgetStateChange(widget.id, tabIndex, true);
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
          nineZoneProps: this.state.nineZoneProps,
          widgetChangeHandler: this,
          targetChangeHandler: this,
          zoneDefProvider: this,
          frontstageDef: this._frontstageDef,
        };
        content = React.cloneElement(this._frontstageDef.frontstageProvider.frontstage, { runtimeProps: frontstageRuntimeProps });
      } else {
        throw Error("FrontstageDef has no FrontstageProvider.");
      }
    }

    return (
      <div id="frontstage-composer">
        {this.renderModalFrontstage()}

        {content}
      </div>
    );
  }

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
      const nineZoneProps = FrontstageManager.NineZoneStateManager.handleResize(zoneId, x, y, handle, filledHeightDiff, prevState.nineZoneProps);
      return {
        nineZoneProps,
      };
    });
  }

  public handleTabClick = (widgetId: number, tabIndex: number) => {
    this.setState((prevState) => {
      const nineZoneProps = FrontstageManager.NineZoneStateManager.handleTabClick(widgetId, tabIndex, prevState.nineZoneProps);
      return {
        nineZoneProps,
      };
    });
  }

  public handleTabDragStart = (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, offset: PointProps) => {
    this.setState((prevState) => {
      const nineZoneProps = FrontstageManager.NineZoneStateManager.handleWidgetTabDragStart(widgetId, tabId, initialPosition, offset, prevState.nineZoneProps);
      return {
        nineZoneProps,
      };
    });
  }

  public handleTabDragEnd = () => {
    this.setState((prevState) => {
      const nineZoneProps = FrontstageManager.NineZoneStateManager.handleWidgetTabDragEnd(prevState.nineZoneProps);
      return {
        nineZoneProps,
      };
    });
  }

  public handleTabDrag = (dragged: PointProps) => {
    this.setState((prevState) => {
      const nineZoneProps = FrontstageManager.NineZoneStateManager.handleWidgetTabDrag(dragged, prevState.nineZoneProps);
      return {
        nineZoneProps,
      };
    });
  }

  public handleTargetChanged(zoneId: WidgetZoneIndex, type: TargetType, isTargeted: boolean): void {
    this.setState((prevState) => {
      const nineZoneProps = isTargeted ? FrontstageManager.NineZoneStateManager.handleTargetChanged({ zoneId, type }, prevState.nineZoneProps) :
        FrontstageManager.NineZoneStateManager.handleTargetChanged(undefined, prevState.nineZoneProps);
      return {
        nineZoneProps,
      };
    });
  }

  public handleWidgetStateChange(widgetId: number, tabIndex: number, isOpening: boolean): void {
    this.setState((prevState) => {
      const nineZoneProps = FrontstageManager.NineZoneStateManager.handleWidgetStateChange(widgetId, tabIndex, isOpening, prevState.nineZoneProps);
      return {
        nineZoneProps,
      };
    });
  }

  public getZoneDef(zoneId: number): ZoneDef | undefined {
    if (!this._frontstageDef)
      throw new Error();

    const zoneDef = this._frontstageDef.getZoneDef(zoneId);

    // Zones can be undefined in a Frontstage

    return zoneDef;
  }

  public getGhostOutlineBounds(zoneId: WidgetZoneIndex): RectangleProps | undefined {
    const nineZone = new NineZone(this.state.nineZoneProps);
    return nineZone.getWidgetZone(zoneId).getGhostOutlineBounds();
  }

  public setZoneAllowsMerging(zoneId: WidgetZoneIndex, allowsMerging: boolean): void {
    this.setState((prevState) => {
      const nineZoneProps = FrontstageManager.NineZoneStateManager.setAllowsMerging(zoneId, allowsMerging, prevState.nineZoneProps);
      return {
        nineZoneProps,
      };
    });
  }

  public mergeZones(toMergeId: WidgetZoneIndex, targetId: WidgetZoneIndex): void {
    this.setState((prevState) => {
      const nineZoneProps = FrontstageManager.NineZoneStateManager.mergeZone(toMergeId, targetId, prevState.nineZoneProps);
      return {
        nineZoneProps,
      };
    });
  }

  private layout() {
    this.setState((prevState) => {
      const element = ReactDOM.findDOMNode(this) as Element;
      let nineZoneProps = prevState.nineZoneProps;
      if (element) {
        nineZoneProps = FrontstageManager.NineZoneStateManager.layout(new Size(element.clientWidth, element.clientHeight), prevState.nineZoneProps);
      }
      return {
        nineZoneProps,
      };
    });
  }
}
