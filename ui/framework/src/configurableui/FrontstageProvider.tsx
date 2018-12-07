/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Frontstage */

import * as React from "react";

import { FrontstageDef } from "./FrontstageDef";
import { FrontstageProps } from "./Frontstage";

/** Provides a Frontstage as a React based definition
 */
export abstract class FrontstageProvider {
  private _frontstageDef?: FrontstageDef;

  /** Constructs a FrontstageDef for this FrontstageProvider */
  public initializeDef(): FrontstageDef {
    const frontstageDef: FrontstageDef = new FrontstageDef();
    frontstageDef.initializeFromProvider(this);
    this._frontstageDef = frontstageDef;
    return frontstageDef;
  }

  /** Get the Frontstage React based definition */
  public abstract get frontstage(): React.ReactElement<FrontstageProps>;

  /** Get the associated FrontstageDef */
  public get frontstageDef(): FrontstageDef | undefined { return this._frontstageDef; }
}
