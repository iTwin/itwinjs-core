/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import { StagePanelLocation } from "./StagePanel";
import { WidgetHost } from "../widgets/WidgetHost";

/** Enum for StagePanel state.
 */
export enum StagePanelState {
  Off,
  Minimized,
  Open,
  Popup,
}

/**
 * A StagePanelDef represents each Stage Panel within a Frontstage.
 */
export class StagePanelDef extends WidgetHost {
  /** Default Height or Width of the panel */
  public size: string = "0";
  /** Panel state.  Defaults to PanelState.Open. */
  public panelState: StagePanelState = StagePanelState.Open;
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
