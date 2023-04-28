/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.spatial.ecrs;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Message } from "../../system/runtime/Message";
import { Strings } from "../../system/runtime/Strings";
import { Coordinate } from "../geom/Coordinate";
import { CRS } from "./CRS";
import { Registry } from "./Registry";
import { VerticalModel } from "./VerticalModel";

/**
 * Class Transform transforms coordinates between coordinate reference systems.
 *
 * @version 1.0 September 2005
 */
/** @internal */
export class Transform {
  /** The name of this module */
  private static readonly MODULE: string = "Transform";

  /** Define the different paths a CRS transformation can take */
  private static readonly _SAME_CRS: int32 = 1;
  private static readonly _FORWARD_PROJECTION: int32 = 2;
  private static readonly _INVERSE_PROJECTION: int32 = 3;
  private static readonly _TWO_PROJECTIONS: int32 = 4;
  private static readonly _TO_WGS: int32 = 6;
  private static readonly _FROM_WGS: int32 = 7;
  private static readonly _FULL_TRANSFORM: int32 = 8;
  private static readonly _VERTICAL: int32 = 9;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Is a conversion between two coordinate systems possible/needed?
   * @param sourceCRS the name/code of the source reference system.
   * @param targetCRS the name/code of the target reference system.
   * @return true if a conversion is possible/needed.
   */
  public static canTransform(sourceCRS: string, targetCRS: string): boolean {
    /* We need two CRSs */
    if (sourceCRS == null || Strings.getLength(sourceCRS) == 0) return false;
    if (targetCRS == null || Strings.getLength(targetCRS) == 0) return false;
    /* Same CRS ? */
    if (Strings.equalsIgnoreCase(targetCRS, sourceCRS)) return true;
    /* Get the two CRSs */
    let source: CRS = Registry.getCRS2(sourceCRS);
    let target: CRS = Registry.getCRS2(targetCRS);
    /* We need two CRSs */
    if (source == null) return false;
    if (target == null) return false;
    /* Vertical transform ? */
    if (source.hasVerticalComponent() || target.hasVerticalComponent()) {
      /* Get the horizontal components */
      let sourceHor: CRS = source.hasVerticalComponent() ? source.getHorizontalComponent() : source;
      let targetHor: CRS = target.hasVerticalComponent() ? target.getHorizontalComponent() : target;
      /* Check transform in the horizontal CRS */
      return Transform.canTransform("" + sourceHor.getCode(), "" + targetHor.getCode());
    }
    /* Same datum ? */
    if (source.getDatum().isCompatible(target.getDatum())) return true;
    /* Chained transform ? */
    if (source.getCode() != CRS.WGS84_2D_CRS_CODE && target.getCode() != CRS.WGS84_2D_CRS_CODE) {
      /* Use WGS as in-between */
      if (source.isWGSCompatible() == false) return false;
      if (target.isWGSCompatible() == false) return false;
      /* Possible */
      return true;
    }
    /* To WGS ? */
    if (target.getCode() == CRS.WGS84_2D_CRS_CODE) {
      /* Use WGS */
      if (source.isWGSCompatible() == false) return false;
      /* Possible */
      return true;
    }
    /* From WGS ? */
    if (source.getCode() == CRS.WGS84_2D_CRS_CODE) {
      /* Use WGS */
      if (target.isWGSCompatible() == false) return false;
      /* Possible */
      return true;
    }
    /* Not possible */
    return false;
  }

  /**
   * Do a vertical transform.
   * @param horizontalCRS the horizontal CRS.
   * @param fromVerticalCRS the vertical CRS to convert from.
   * @param from the coordinate to convert from.
   * @param toVerticalCRS the vertical CRS to convert to.
   * @param to the coordinate to convert to.
   */
  public static transformVertical(
    horizontalCRS: CRS,
    fromVerticalCRS: CRS,
    from: Coordinate,
    toVerticalCRS: CRS,
    to: Coordinate
  ): void {
    /* 1: From 'ellipsoid' to 'ellipsoid' height ? */
    if (fromVerticalCRS == null && toVerticalCRS == null) {
      /* Straight copy */
      to.setX(from.getX());
      to.setY(from.getY());
      to.setZ(from.getZ());
      //Message.print(MODULE,"_VERTICAL: ellipsoid->ellipsoid: "+from.getZ());
    } else if (fromVerticalCRS == null && toVerticalCRS != null) {
      /* 2: From 'ellipsoid' to 'local' height ? */
      /* Get the geoid separation */
      let geoidModel: VerticalModel = toVerticalCRS.getVerticalModel();
      let toZ: float64 = from.getZ();
      if (geoidModel != null) toZ = geoidModel.toLocalHeight(horizontalCRS, from);
      else
        Message.printWarning(
          Transform.MODULE,
          "Target vertical CRS " + toVerticalCRS + " does not have a height model"
        );
      //Message.print(MODULE,"_VERTICAL: ellipsoid->local: "+from.getZ()+"->"+toZ);
      /* Substract the separation */
      to.setX(from.getX());
      to.setY(from.getY());
      to.setZ(toZ);
    } else if (fromVerticalCRS != null && toVerticalCRS == null) {
      /* 3: From 'local' to 'ellipsoid' height ? */
      /* Get the geoid separation */
      let geoidModel: VerticalModel = fromVerticalCRS.getVerticalModel();
      let toZ: float64 = from.getZ();
      if (geoidModel != null) toZ = geoidModel.toEllipsoidHeight(horizontalCRS, from);
      else
        Message.printWarning(
          Transform.MODULE,
          "Source vertical CRS " + fromVerticalCRS + " does not have a height model"
        );
      //Message.print(MODULE,"_VERTICAL: local->ellipsoid: "+from.getZ()+"->"+toZ);
      /* Add the separation */
      to.setX(from.getX());
      to.setY(from.getY());
      to.setZ(toZ);
    } else {
      /* 4: From 'local1' to 'local2' */
      /* Same ? */
      if (fromVerticalCRS.getCode() == toVerticalCRS.getCode()) {
        /* Straight copy */
        to.setX(from.getX());
        to.setY(from.getY());
        to.setZ(from.getZ());
        //Message.print(MODULE,"_VERTICAL: local->local same: "+from.getZ());
      } else {
        /* Get the 'from' ellipsoid height */
        let fromGeoidModel: VerticalModel = fromVerticalCRS.getVerticalModel();
        let fromZ: float64 = from.getZ();
        if (fromGeoidModel != null) fromZ = fromGeoidModel.toEllipsoidHeight(horizontalCRS, from);
        else
          Message.printWarning(
            Transform.MODULE,
            "Source vertical CRS " + fromVerticalCRS + " does not have a height model"
          );
        /* Copy */
        to.setX(from.getX());
        to.setY(from.getY());
        to.setZ(fromZ);
        /* Get the 'to' local height */
        let toGeoidModel: VerticalModel = toVerticalCRS.getVerticalModel();
        let toZ: float64 = to.getZ();
        if (toGeoidModel != null) toZ = toGeoidModel.toLocalHeight(horizontalCRS, to);
        else
          Message.printWarning(
            Transform.MODULE,
            "Target vertical CRS " + toVerticalCRS + " does not have a height model"
          );
        //Message.print(MODULE,"_VERTICAL: local->local: "+from.getZ()+"->"+fromZ+"->"+toZ);
        /* Copy */
        to.setZ(toZ);
      }
    }
  }

  /**
   * Get the transformation path from one CRS to another CRS.
   * @param sourceCRS the source reference system.
   * @param targetCRS the target reference system.
   * @return the transformation path.
   */
  public static getTransformPath(sourceCRS: CRS, targetCRS: CRS): int32 {
    /* Same CRS ? */
    if (targetCRS.getCode() == sourceCRS.getCode()) {
      return Transform._SAME_CRS;
    }
    /* Compatible CRS ? */
    if (targetCRS.isCompatible(sourceCRS)) {
      return Transform._SAME_CRS;
    }
    /* Vertical transform ? */
    if (sourceCRS.hasVerticalComponent() || targetCRS.hasVerticalComponent()) {
      return Transform._VERTICAL;
    }
    /* Same datum/ellipsoid ? (added on 24/11/2011) */
    if (sourceCRS.getDatum().isCompatible(targetCRS.getDatum())) {
      /* Is the target a projection of the source ? (added on 05/12/2011) */
      if (targetCRS.isProjectionOf(sourceCRS)) {
        return Transform._FORWARD_PROJECTION;
      }
      /* Is the source a projection of the target ? (added on 05/12/2011) */
      if (sourceCRS.isProjectionOf(targetCRS)) {
        return Transform._INVERSE_PROJECTION;
      }
      /* Two projections of the same base? */
      if (
        sourceCRS.isProjected() &&
        targetCRS.isProjected() &&
        targetCRS.getBaseCRS().isCompatible(sourceCRS.getBaseCRS())
      ) {
        return Transform._TWO_PROJECTIONS;
      }
    }
    /* To WGS ? */
    if (targetCRS.getCode() == CRS.WGS84_2D_CRS_CODE) {
      return Transform._TO_WGS;
    }
    /* From WGS ? */
    if (sourceCRS.getCode() == CRS.WGS84_2D_CRS_CODE) {
      return Transform._FROM_WGS;
    }
    /* Use WGS as in-between (slowest path) */
    return Transform._FULL_TRANSFORM;
  }

  /**
   * Convert between two coordinate reference systems.
   * @param sourceCRS the source reference system.
   * @param from the coordinate to convert from.
   * @param targetCRS the target reference system.
   * @param to the coordinate to convert to.
   */
  public static transformWithPath(path: int32, sourceCRS: CRS, from: Coordinate, targetCRS: CRS, to: Coordinate): void {
    //Message.print(MODULE,"---------->>>");
    //Message.print(MODULE,"TRANSFORM: sourceCRS = "+sourceCRS.getCode());
    //Message.print(MODULE,"TRANSFORM: targetCRS = "+targetCRS.getCode());
    //Message.print(MODULE,"TRANSFORM: from = "+from);
    //Message.print(MODULE,"TRANSFORM: path = "+path);
    /* Same CRS ? */
    if (path == Transform._SAME_CRS) {
      //Message.print(MODULE,"TRANSFORM: _SAME_CRS");
      /* Straight copy */
      to.setX(from.getX());
      to.setY(from.getY());
      to.setZ(from.getZ());
      //Message.print(MODULE,"TRANSFORMED: to = "+to);
      return;
    }
    /* Is the target a projection of the source ? (added on 05/12/2011) */
    if (path == Transform._FORWARD_PROJECTION) {
      //Message.print(MODULE,"TRANSFORM: _FORWARD_PROJECTION");
      /* Apply the projection */
      targetCRS.toProjected(from, to);
      //Message.print(MODULE,"TRANSFORMED: to = "+to);
      return;
    }
    /* Is the source a projection of the target ? (added on 05/12/2011) */
    if (path == Transform._INVERSE_PROJECTION) {
      //Message.print(MODULE,"TRANSFORM: _INVERSE_PROJECTION");
      /* Reverse the projection */
      sourceCRS.fromProjected(from, to);
      //Message.print(MODULE,"TRANSFORMED: to = "+to);
      return;
    }
    /* Two projections of the same base? */
    if (path == Transform._TWO_PROJECTIONS) {
      //Message.print(MODULE,"TRANSFORM: _TWO_PROJECTIONS");
      /* Reverse the projection */
      sourceCRS.fromProjected(from, to);
      /* Apply the projection */
      targetCRS.toProjected(to, to);
      //Message.print(MODULE,"TRANSFORMED: to = "+to);
      return;
    }
    /* To WGS ? */
    if (path == Transform._TO_WGS) {
      //Message.print(MODULE,"TRANSFORM: _TO_WGS");
      /* Use WGS */
      let toWGS: Coordinate = sourceCRS.toWGS(from);
      /* Set the target */
      to.setX(toWGS.getX());
      to.setY(toWGS.getY());
      to.setZ(toWGS.getZ());
      //Message.print(MODULE,"TRANSFORMED: to = "+to);
      return;
    }
    /* From WGS ? */
    if (path == Transform._FROM_WGS) {
      //Message.print(MODULE,"TRANSFORM: _FROM_WGS");
      /* Use WGS */
      let fromWGS: Coordinate = targetCRS.fromWGS(from);
      /* Set the target */
      to.setX(fromWGS.getX());
      to.setY(fromWGS.getY());
      to.setZ(fromWGS.getZ());
      //Message.print(MODULE,"TRANSFORMED: to = "+to);
      return;
    }
    /* Full transform ? */
    if (path == Transform._FULL_TRANSFORM) {
      //Message.print(MODULE,"TRANSFORM: _FULL_TRANSFORM");
      /* Use WGS as in-between */
      let toWGS: Coordinate = sourceCRS.toWGS(from);
      let fromWGS: Coordinate = targetCRS.fromWGS(toWGS);
      /* Set the target */
      to.setX(fromWGS.getX());
      to.setY(fromWGS.getY());
      to.setZ(fromWGS.getZ());
      //Message.print(MODULE,"TRANSFORMED: to = "+to);
      return;
    }
    /* Vertical transform ? */
    if (path == Transform._VERTICAL) {
      //Message.print(MODULE,"TRANSFORM: _VERTICAL");
      /* Get the horizontal components */
      let sourceHorCRS: CRS = sourceCRS.hasVerticalComponent() ? sourceCRS.getHorizontalComponent() : sourceCRS;
      let targetHorCRS: CRS = targetCRS.hasVerticalComponent() ? targetCRS.getHorizontalComponent() : targetCRS;
      /* Get the vertical components */
      let sourceVerCRS: CRS = sourceCRS.hasVerticalComponent() ? sourceCRS.getVerticalComponent() : null;
      let targetVerCRS: CRS = targetCRS.hasVerticalComponent() ? targetCRS.getVerticalComponent() : null;
      /* Put the source coordinate in the ellipsoid height */
      if (sourceVerCRS != null) {
        /* Move to the default 'ellipsoid' height */
        //Message.print(MODULE,"TRANSFORM: source to ellipsoidZ");
        Transform.transformVertical(sourceHorCRS, sourceVerCRS, from, null, to);
        from = to;
        //Message.print(MODULE,"TRANSFORM: source ellipsoidZ = "+to);
      }
      /* Get the ellipsoid height */
      let ellipsoidZ: float64 = from.getZ();
      if (sourceHorCRS.isGeoCentric()) {
        /* Calculate the ellipsoid height */
        let geographic: Coordinate = new Coordinate(0.0, 0.0, 0.0);
        sourceHorCRS.getEllipsoid().toGeoGraphic(from, geographic);
        ellipsoidZ = geographic.getZ();
      }
      /* Transform in the horizontal CRS (keep the WGS Z (and not the Bessel Z) for transform from WGS to RD-NAP) */
      //Message.print(MODULE,"TRANSFORM: ellipsoidZ = "+ellipsoidZ);
      //Message.print(MODULE,"TRANSFORM: horizontal "+sourceHorCRS.getCode()+" -> "+targetHorCRS.getCode());
      Transform.transformCRS(sourceHorCRS, from, targetHorCRS, to);
      /* Is the target CRS horizontal? */
      if (targetHorCRS.isGeoCentric() == false) {
        /* Keep the ellipsoid height after the horizontal transform */
        to.setZ(ellipsoidZ);
      }
      from = to;
      //Message.print(MODULE,"TRANSFORM: intermediate = "+from);
      /* Put the target coordinate in the vertical CRS */
      if (targetVerCRS != null) {
        /* Move from the default 'ellipsoid' height */
        Transform.transformVertical(targetHorCRS, null, from, targetVerCRS, to);
        from = to;
        //Message.print(MODULE,"TRANSFORM: target vtransf = "+to);
      }
      /* Done */
      //Message.print(MODULE,"TRANSFORMED: to = "+to);
      return;
    }
    //Message.print(MODULE,"TRANSFORMED: UNKNOWN!");
  }

  /**
   * Convert between two coordinate reference systems.
   * @param sourceCRS the source reference system.
   * @param from the coordinate to convert from.
   * @param targetCRS the target reference system.
   * @param to the coordinate to convert to.
   */
  public static transformCRS(sourceCRS: CRS, from: Coordinate, targetCRS: CRS, to: Coordinate): void {
    Transform.transformWithPath(Transform.getTransformPath(sourceCRS, targetCRS), sourceCRS, from, targetCRS, to);
  }

  /**
   * Convert between two coordinate reference systems.
   * @param sourceCRS the name/code of the source reference system.
   * @param from the coordinate to convert from.
   * @param targetCRS the name/code of the target reference system.
   * @param to the coordinate to convert to.
   */
  public static transform(sourceCRS: string, from: Coordinate, targetCRS: string, to: Coordinate): void {
    /* Same CRS ? */
    if (Strings.equalsIgnoreCase(targetCRS, sourceCRS)) {
      /* Straight copy */
      to.setX(from.getX());
      to.setY(from.getY());
      to.setZ(from.getZ());
      return;
    }
    /* Get the two CRSs */
    let source: CRS = Registry.getCRS2(sourceCRS);
    let target: CRS = Registry.getCRS2(targetCRS);
    /* Transform */
    Transform.transformCRS(source, from, target, to);
  }
}
