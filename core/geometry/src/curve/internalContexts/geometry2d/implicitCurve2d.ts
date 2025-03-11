/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Point2d, Vector2d } from "../../../geometry3d/Point2dVector2d";
import { XAndY } from "../../../geometry3d/XYZProps";

export abstract class ImplicitCurve2d {
    /**
     * Return the implicit function value at xy
     * @param xy point for evaluation
     */
   public abstract functionValue (xy: XAndY):number;
    /**
     * Return the implicit function gradiant at xy
     * @param xy point for evaluation
     */
    public abstract gradiant (xy: XAndY):Vector2d;

   /**
    * Find all perpendiculars from space point to the curve.
    * Pass each in turn to the handler.
    * @param spacePoint
    */
   public abstract emitPerpendiculars (spacePoint: Point2d,  handler :(curvePoint: Point2d)=>any):any;
    /**
    * Return true if the item has degenerate defining data.
    */
    public abstract isDegenerate ():boolean;

}
