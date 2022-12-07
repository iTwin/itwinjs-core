/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */

import { NewtonEvaluatorRtoR } from "../../numerics/Newton";
import { CurvePrimitive } from "../CurvePrimitive";

/** Intermediate class for managing the parentCurve announcements from an IStrokeHandler.
 * @internal
 */
export abstract class NewtonRtoRStrokeHandler extends NewtonEvaluatorRtoR {
  protected _parentCurvePrimitive: CurvePrimitive | undefined;

  constructor() {
    super();
    this._parentCurvePrimitive = undefined;
  }

  /** retain the parentCurvePrimitive.
   * * Calling this method tells the handler that the parent curve is to be used for detail searches.
   * * Example: Transition spiral search is based on linestring first, then the exact spiral.
   * * Example: CurveChainWithDistanceIndex does NOT do this announcement -- the constituents act independently.
   */
  public startParentCurvePrimitive(curve: CurvePrimitive | undefined) {
    this._parentCurvePrimitive = curve;
  }

  /** Forget the parentCurvePrimitive */
  public endParentCurvePrimitive(_curve: CurvePrimitive | undefined) {
    this._parentCurvePrimitive = undefined;
  }
}
