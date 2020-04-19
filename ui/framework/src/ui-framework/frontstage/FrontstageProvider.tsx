/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */

import * as React from "react";

import { FrontstageDef } from "./FrontstageDef";
import { FrontstageProps } from "./Frontstage";

/** Provides a Frontstage as a React based definition
 * @public
 */
export abstract class FrontstageProvider {
  private _frontstageDef?: FrontstageDef;

  /** Initializes a FrontstageDef for this FrontstageProvider
   * @param frontstageDef  Optional FrontstageDef to initialize. If not provided, a FrontstageDef is constructed.
   * @returns Initialized FrontstageDef
   */
  public initializeDef(frontstageDef?: FrontstageDef): FrontstageDef {
    this._frontstageDef = frontstageDef ? frontstageDef : new FrontstageDef();
    this._frontstageDef.initializeFromProvider(this);
    return this._frontstageDef;
  }

  /** Get the Frontstage React based definition */
  public abstract get frontstage(): React.ReactElement<FrontstageProps>;

  /** Get the associated FrontstageDef */
  public get frontstageDef(): FrontstageDef | undefined { return this._frontstageDef; }
}
