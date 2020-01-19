/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */

import { StagePanelLocation } from "./StagePanel";
import { WidgetHost } from "../widgets/WidgetHost";
import { UiEvent } from "@bentley/ui-core";
import { FrontstageManager } from "../frontstage/FrontstageManager";

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

  /** Default size of the panel */
  public size: number | undefined = undefined;

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

  /** Indicates whether the panel is resizable. */
  public resizable: boolean = false;
  /** Any application data to attach to this Panel. */
  public applicationData?: any;
  /** Location of panel. */
  public location: StagePanelLocation = StagePanelLocation.Left;

  /** Constructor for PanelDef.
   */
  constructor() {
    super();
  }
}
