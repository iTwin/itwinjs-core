/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";
import * as ReactDOM from "react-dom";

import { FrontstageManager, FrontstageActivatedEventArgs, ModalFrontstageInfo, ModalFrontstageStackChangedEventArgs } from "./FrontstageManager";
import { FrontstageDef } from "./FrontstageDef";
import { FrameworkFrontstage } from "./FrameworkFrontstage";
import { ZoneDef } from "./ZoneDef";
import { ModalFrontstage } from "./ModalFrontstage";

import ResizeHandle from "@bentley/ui-ninezone/lib/widget/rectangular/ResizeHandle";
import NineZone, { getDefaultProps as getDefaultNineZoneState } from "@bentley/ui-ninezone/lib/zones/state/NineZone";
import Size from "@bentley/ui-ninezone/lib/utilities/Size";
import Point from "@bentley/ui-ninezone/lib/utilities/Point";
import { DropTarget as ZoneDropTarget } from "@bentley/ui-ninezone/lib/zones/state/Management";
import { RectangleProps } from "@bentley/ui-ninezone/lib/utilities/Rectangle";

/** Interface defining callbacks for widget changes */
export interface WidgetChangeHandler {
  handleOnWidgetResize(zoneId: number, x: number, y: number, handle: ResizeHandle): void;
  handleWidgetTabClick(widgetId: number, tabIndex: number): void;
  handleWidgetTabDragBehaviorChanged(widgetId: number, isDragging: boolean): void;
  handleWidgetTabDrag(dragged: Point): void;
}

/** Interface defining callbacks for ZoneDropTarget changes */
export interface TargetChangeHandler {
  handleTargetChanged(widgetId: number, dropTarget: ZoneDropTarget, isTargeted: boolean): void;
}

/** Interface defining a provider for Ghost Outline */
export interface GhostOutlineProvider {
  getGhostOutlineBounds(zoneId: number): RectangleProps | undefined;
}

/** Interface defining a provider for Zone definitions */
export interface ZoneDefProvider {
  getZoneDef(zoneId: number): ZoneDef | undefined;
}

/** Props for the FrontstageComposer component.
 */
export interface FrontstageComposerProps {
  className?: string;
  style?: React.CSSProperties;
}

/** State for the FrontstageComposer component.
 */
export interface FrontstageComposerState {
  frontstageId: string;
  modalFronstageStackDepth: number;
  nineZone: NineZone;
}

/** FrontstageComposer React component.
 */
export class FrontstageComposer extends React.Component<FrontstageComposerProps, FrontstageComposerState>
  implements WidgetChangeHandler, TargetChangeHandler, ZoneDefProvider, GhostOutlineProvider {

  private _frontstageDef: FrontstageDef | undefined;

  /** hidden */
  public readonly state: Readonly<FrontstageComposerState>;

  constructor(props: FrontstageComposerProps, context?: any) {
    super(props, context);

    const activeFrontstageId = FrontstageManager.activeFrontstageId;
    this._frontstageDef = FrontstageManager.findFrontstageDef(activeFrontstageId);

    this.state = {
      nineZone: {
        ...getDefaultNineZoneState(),
        isInFooterMode: (this._frontstageDef) ? this._frontstageDef.isInFooterMode : false,
      },
      frontstageId: activeFrontstageId,
      modalFronstageStackDepth: FrontstageManager.modalFrontstageStackDepth,
    };
  }

  private _handleFrontstageActivatedEvent = (args: FrontstageActivatedEventArgs) => {
    this._frontstageDef = FrontstageManager.findFrontstageDef(args.frontstageId);

    this.setState((prevState, _props) => {
      const frontstageId = args.frontstageId;
      const isInFooterMode = (this._frontstageDef) ? this._frontstageDef.isInFooterMode : false;
      const nineZone = FrontstageManager.NineZoneStateManagement.onChangeFooterMode(isInFooterMode, prevState.nineZone);
      return {
        frontstageId,
        nineZone,
      };
    });
  }

  private _handleModalFrontstageStackChangedEvent = (_args: ModalFrontstageStackChangedEventArgs) => {
    this.setState((_prevState) => {
      return {
        modalFronstageStackDepth: FrontstageManager.modalFrontstageStackDepth,
      };
    });

  }

  private _navigationBack = () => {
  }

  private _closeModal = () => {
    FrontstageManager.closeModalFrontstage();
  }

  private renderModalFrontstage() {
    const activeModalFrontstage: ModalFrontstageInfo | undefined = FrontstageManager.activeModalFrontstage;
    if (!activeModalFrontstage)
      return undefined;

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
    if (!this._frontstageDef)
      return null;

    return (
      <>
        {this.renderModalFrontstage()}

        <FrameworkFrontstage
          frontstageDef={this._frontstageDef}
          nineZone={this.state.nineZone}
          widgetChangeHandler={this}
          targetChangeHandler={this}
          zoneDefProvider={this}
          ghostOutlineProvider={this}
        />
      </>
    );
  }

  public componentDidMount(): void {
    this.layout();
    window.addEventListener("resize", this._handleWindowResize, true);
    FrontstageManager.FrontstageActivatedEvent.addListener(this._handleFrontstageActivatedEvent);
    FrontstageManager.ModalFrontstageStackChangedEvent.addListener(this._handleModalFrontstageStackChangedEvent);
  }

  public componentWillUnmount(): void {
    document.removeEventListener("resize", this._handleWindowResize, true);
    FrontstageManager.FrontstageActivatedEvent.removeListener(this._handleFrontstageActivatedEvent);
    FrontstageManager.ModalFrontstageStackChangedEvent.removeListener(this._handleModalFrontstageStackChangedEvent);
  }

  private _handleWindowResize = () => {
    this.layout();
  }

  public handleOnWidgetResize = (zoneId: number, x: number, y: number, handle: ResizeHandle) => {
    this.setState((prevState) => {
      const nineZone = FrontstageManager.NineZoneStateManagement.onResize(zoneId, x, y, handle, prevState.nineZone);
      return {
        nineZone,
      };
    });
  }

  public handleWidgetTabClick = (widgetId: number, tabIndex: number) => {
    this.setState((prevState) => {
      const nineZone = FrontstageManager.NineZoneStateManagement.onTabClick(widgetId, tabIndex, prevState.nineZone);
      return {
        nineZone,
      };
    });
  }

  public handleWidgetTabDragBehaviorChanged = (widgetId: number, isDragging: boolean) => {
    this.setState((prevState) => {
      const nineZone = FrontstageManager.NineZoneStateManagement.onDragBehaviorChanged(widgetId, isDragging, prevState.nineZone);
      return {
        nineZone,
      };
    });
  }

  public handleWidgetTabDrag = (dragged: Point) => {
    this.setState((prevState) => {
      const nineZone = FrontstageManager.NineZoneStateManagement.onWidgetTabDrag(dragged, prevState.nineZone);
      return {
        nineZone,
      };
    });
  }

  public handleTargetChanged(widgetId: number, dropTarget: ZoneDropTarget, isTargeted: boolean): void {
    this.setState((prevState) => {
      const nineZone = FrontstageManager.NineZoneStateManagement.onTargetChanged(isTargeted ? widgetId : undefined, dropTarget, prevState.nineZone);
      return {
        nineZone,
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

  public getGhostOutlineBounds(zoneId: number): RectangleProps | undefined {
    return FrontstageManager.NineZoneStateManagement.getGhostOutlineBounds(zoneId, this.state.nineZone);
  }

  private layout() {
    this.setState((prevState) => {
      const element = ReactDOM.findDOMNode(this) as Element;
      let nineZone = prevState.nineZone;
      if (element) {
        nineZone = FrontstageManager.NineZoneStateManagement.onInitialLayout(new Size(element.clientWidth, element.clientHeight), prevState.nineZone);
      }
      return {
        nineZone,
      };
    });
  }
}
