/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */


import { Point2d } from "../geometry3d/Point2dVector2d";
import { XAndY } from "../geometry3d/XYZProps";

export abstract class ImplicitCurve2d {
   public abstract functionValue (xy: XAndY):number;
   /**
    * Return a point on the curve and "closest" to xy.
    * * If no bias data is given, this is "closest" in simple distance
    * * If bias is given as a point or distance and multiple perpendiculars or cusps are available
    *      the returned point is the one closest to the bias point or distance.
    * * Note that in the bias case the returned point may be at a local maximum distance
    *      such as the far side of a circle.
    * @param xy
    * @param biasPoint
    */
   public abstract closestPoint (xy: XAndY, biasPoint?:XAndY | number): Point2d;
    /**
    * Return true if the item has degenerate defining data.
    */
    public abstract isDegenerate ():boolean;

}
