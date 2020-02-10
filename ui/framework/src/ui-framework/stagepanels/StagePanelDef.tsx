/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */

import { StagePanelLocation } from "@bentley/ui-abstract";
import { UiEvent } from "@bentley/ui-core";
import { StagePanelProps } from "./StagePanel";
import { WidgetHost } from "../widgets/WidgetHost";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { WidgetProps } from "../widgets/WidgetProps";
import { WidgetDef } from "../widgets/WidgetDef";

/** Enum for StagePanel state.
 * @alpha
 */
export enum StagePanelState {
  Off,
  Minimized,
  Open,
  Popup,
}

/** Panel State Changed Event Args interface.
 * @alpha
 */
export interface PanelStateChangedEventArgs {
  panelDef: StagePanelDef;
  panelState: StagePanelState;
}

/** Widget State Changed Event class.
 * @alpha
 */
export class PanelStateChangedEvent extends UiEvent<PanelStateChangedEventArgs> { }

/**
 * A StagePanelDef represents each Stage Panel within a Frontstage.
 * @alpha
 */
export class StagePanelDef extends WidgetHost {
  private _panelState = StagePanelState.Open;
  private _size: number | undefined = undefined;
  private _resizable: boolean = false;
  private _applicationData?: any;
  private _location: StagePanelLocation = StagePanelLocation.Left;

  /** Constructor for PanelDef.
   */
  constructor() {
    super();
  }

  /** Default size of the panel */
  public get size(): number | undefined { return this._size; }
  /** Indicates whether the panel is resizable. */
  public get resizable(): boolean { return this._resizable; }
  /** Any application data to attach to this Panel. */
  public get applicationData(): any | undefined { return this._applicationData; }
  /** Location of panel. */
  public get location(): StagePanelLocation { return this._location; }

  /** Panel state.  Defaults to PanelState.Open. */
  public get panelState() {
    return this._panelState;
  }

  public set panelState(panelState: StagePanelState) {
    if (panelState === this._panelState)
      return;
    this._panelState = panelState;
    FrontstageManager.onPanelStateChangedEvent.emit({
      panelDef: this,
      panelState,
    });
  }

  /** @internal */
  public initializePanelState(panelState: StagePanelState) {
    this._panelState = panelState;
  }

  /** @internal */
  public initializeFromProps(props: StagePanelProps, panelLocation?: StagePanelLocation): void {
    this._size = props.size;
    if (panelLocation !== undefined)
      this._location = panelLocation;
    if (props.defaultState !== undefined)
      this.initializePanelState(props.defaultState);
    this._resizable = props.resizable;
    if (props.applicationData !== undefined)
      this._applicationData = props.applicationData;

    if (props.widgets) {
      props.widgets.forEach((widgetNode: React.ReactElement<WidgetProps>) => {
        const widgetDef = new WidgetDef(widgetNode.props);
        this.addWidgetDef(widgetDef);
      });
    }
  }

}
