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

import { AList } from "../../system/collection/AList";
import { Message } from "../../system/runtime/Message";
import { Strings } from "../../system/runtime/Strings";
import { Coordinate } from "../geom/Coordinate";
import { Axis } from "./Axis";
import { CRS } from "./CRS";
import { Registry } from "./Registry";
import { Unit } from "./Unit";

/**
 * Class CoordinateSystem manages the different coordinate systems.
 *
 * @version 1.0 October 2014
 */
/** @internal */
export class CoordinateSystem {
  /** The name of this module */
  private static readonly MODULE: string = "CoordinateSystem";

  /** The type of coordinate reference system (PROJECTED,GEOGRAPHIC_2D,...) */
  private _type: int32;
  /** The coordinate-system code */
  private _csCode: int32;
  /** The coordinate axes (defined by the csCode) */
  private _axes: AList<Axis>;

  /** The X axis (derived) */
  private _xAxis: Axis;
  /** The Y axis (derived) */
  private _yAxis: Axis;
  /** The Z axis (derived) */
  private _zAxis: Axis;
  /** The X unit (derived) */
  private _xUnit: Unit;
  /** The Y unit (derived) */
  private _yUnit: Unit;
  /** The Z unit (derived) */
  private _zUnit: Unit;

  /**
   * Check if easting-northing axis order is swapped?
   * @param csCode the code of the coordinate-system.
   * @return true for swapped CRS.
   */
  public static isSwappedEN(csCode: int32): boolean {
    if (csCode == 1029) return true;
    //    	if (csCode==4400) return true; // this used to be swapped in the EPSG database, but not anymore
    if (csCode == 4498) return true;
    if (csCode == 4500) return true;
    if (csCode == 4532) return true;
    return false;
  }

  /**
   * Create a coordinate system.
   * @param type the type of coordinate reference system (PROJECTED,GEOGRAPHIC_2D,...).
   * @param csCode the coordinate-system code.
   * @param axes the (sorted on order) coordinate axes.
   * @return the coordinate system (null for an identify system).
   */
  public static create(
    type: int32,
    csCode: int32,
    axes: AList<Axis>
  ): CoordinateSystem {
    let coordinateSystem: CoordinateSystem = new CoordinateSystem(
      type,
      csCode,
      axes
    );
    if (coordinateSystem.isIdentity()) return null;
    return coordinateSystem;
  }

  /**
   * Create a new coordinate system.
   * @param type the type of coordinate reference system (PROJECTED,GEOGRAPHIC_2D,...).
   * @param csCode the coordinate-system code.
   * @param axes the (sorted on order) coordinate axes.
   */
  public constructor(type: int32, csCode: int32, axes: AList<Axis>) {
    /* Store the parameters */
    this._type = type;
    this._csCode = csCode;
    this._axes = axes;
    /* Clear */
    this._xAxis = null;
    this._yAxis = null;
    this._zAxis = null;
    this._xUnit = null;
    this._yUnit = null;
    this._zUnit = null;
    /* Projection? */
    if (type == CRS.PROJECTED) this.parseProjection();
    /* Log? */
    if (this.isIdentity() == false) {
      /* Log */
      Message.print(
        CoordinateSystem.MODULE,
        "Created coordinate system " + this._csCode
      );
      if (this._xAxis != null)
        Message.print(
          CoordinateSystem.MODULE,
          "X axis '" +
            this._xAxis.getAbbreviation() +
            "'/'" +
            this._xAxis.getAxisName() +
            "' (" +
            this._xAxis.getOrder() +
            ")"
        );
      if (this._yAxis != null)
        Message.print(
          CoordinateSystem.MODULE,
          "Y axis '" +
            this._yAxis.getAbbreviation() +
            "'/'" +
            this._yAxis.getAxisName() +
            "' (" +
            this._yAxis.getOrder() +
            ")"
        );
      if (this._zAxis != null)
        Message.print(
          CoordinateSystem.MODULE,
          "Z axis '" +
            this._zAxis.getAbbreviation() +
            "'/'" +
            this._zAxis.getAxisName() +
            "' (" +
            this._zAxis.getOrder() +
            ")"
        );
      if (this._xUnit != null)
        Message.print(
          CoordinateSystem.MODULE,
          "X unit '" + this._xUnit.getName() + "'"
        );
      if (this._yUnit != null)
        Message.print(
          CoordinateSystem.MODULE,
          "Y unit '" + this._yUnit.getName() + "'"
        );
      if (this._zUnit != null)
        Message.print(
          CoordinateSystem.MODULE,
          "Z unit '" + this._zUnit.getName() + "'"
        );
    }
  }

  /**
   * Get the type of coordinate reference system (PROJECTED,GEOGRAPHIC_2D,...).
   * @return the type.
   */
  public getType(): int32 {
    return this._type;
  }

  /**
   * Get the code of the coordinate system.
   * @return the code of the coordinate system.
   */
  public getCode(): int32 {
    return this._csCode;
  }

  /**
   * Get the coordinate axes.
   * @return the coordinate axes.
   */
  public getAxes(): AList<Axis> {
    return this._axes;
  }

  /**
   * Do we have an identity transformation between local and standard forms?
   * @return true for an identity transform.
   */
  public isIdentity(): boolean {
    /* Check the axis */
    if (this._xAxis != null && this._xAxis.getOrder() != 1) return false;
    if (this._yAxis != null && this._yAxis.getOrder() != 2) return false;
    if (this._zAxis != null && this._zAxis.getOrder() != 3) return false;
    /* Check the units */
    if (this._xUnit != null) return false;
    if (this._yUnit != null) return false;
    if (this._zUnit != null) return false;
    /* We have identity */
    return true;
  }

  /**
   * Get the X axis.
   * @return the X axis.
   */
  public getXAxis(): Axis {
    return this._xAxis;
  }

  /**
   * Get the Y axis.
   * @return the Y axis.
   */
  public getYAxis(): Axis {
    return this._yAxis;
  }

  /**
   * Get the Z axis.
   * @return the Z axis.
   */
  public getZAxis(): Axis {
    return this._zAxis;
  }

  /**
   * Get the unit of the first axis.
   * @return the unit of the first axis (null for the default unit).
   */
  public getXUnit(): Unit {
    return this._xUnit;
  }

  /**
   * Get the unit of the second axis.
   * @return the unit of the second axis (null for the default unit).
   */
  public getYUnit(): Unit {
    return this._yUnit;
  }

  /**
   * Get the unit of the third axis.
   * @return the unit of the third axis (null for the default unit).
   */
  public getZUnit(): Unit {
    return this._zUnit;
  }

  /**
   * Parse a projection type coordinate system.
   */
  private parseProjection(): void {
    /* Get the abbreviations */
    let name1: string = this._axes.get(0).getAbbreviation();
    let name2: string = this._axes.get(1).getAbbreviation();
    //        /* Get the axis names */
    //        String aname1 = this._axis[0].getAxisName();
    //        String aname2 = this._axis[1].getAxisName();
    //        /* Special cases */
    //        if (aname1.equalsIgnoreCase("Northing") && aname2.equalsIgnoreCase("Easting"))
    //        {
    //            /* Coordinate system 4531, used by CRS 2180: ETRS89 / Poland CS92 */
    //            name1 = "N";
    //            name2 = "E";
    //        }
    /* Check the various combinations */
    let xy1: boolean =
      Strings.equalsIgnoreCase(name1, "X") &&
      Strings.equalsIgnoreCase(name2, "Y");
    let xy2: boolean =
      Strings.equalsIgnoreCase(name1, "E") &&
      Strings.equalsIgnoreCase(name2, "N");
    let xy3: boolean =
      Strings.equalsIgnoreCase(name1, "E(X)") &&
      Strings.equalsIgnoreCase(name2, "N(Y)");
    let xy4: boolean =
      Strings.equalsIgnoreCase(name1, "M") &&
      Strings.equalsIgnoreCase(name2, "P"); // csCode 1024, Portuguese
    let yx1: boolean =
      Strings.equalsIgnoreCase(name1, "Y") &&
      Strings.equalsIgnoreCase(name2, "X");
    let yx2: boolean =
      Strings.equalsIgnoreCase(name1, "N") &&
      Strings.equalsIgnoreCase(name2, "E");
    /* XY sequence? */
    if (xy1 || xy2 || xy3 || xy4) {
      this._xAxis = this._axes.get(0);
      this._yAxis = this._axes.get(1);
    } else if (yx1 || yx2) {
      /* YX sequence */
      this._xAxis = this._axes.get(1);
      this._yAxis = this._axes.get(0);
    } else {
      /* Default */
      this._xAxis = this._axes.get(0);
      this._yAxis = this._axes.get(1);
      /* Log */
      Message.printWarning(
        CoordinateSystem.MODULE,
        "Invalid projected axis '" + name1 + "','" + name2 + "'"
      );
    }
    /* Do we have a Z axis? */
    if (this._axes.size() >= 3) {
      this._zAxis = this._axes.get(2);
    }
    /* Get the units */
    if (this._xAxis != null && this._xAxis.getUnitCode() != Unit.METER)
      this._xUnit = Registry.getUnit(this._xAxis.getUnitCode());
    if (this._yAxis != null && this._yAxis.getUnitCode() != Unit.METER)
      this._yUnit = Registry.getUnit(this._yAxis.getUnitCode());
    if (this._zAxis != null && this._zAxis.getUnitCode() != Unit.METER)
      this._zUnit = Registry.getUnit(this._zAxis.getUnitCode());
  }

  /**
   * Get a local coordinate.
   * @param local the coordinate.
   * @param axis the standard axis to retrieve.
   * @param order the default order.
   * @return the coordinate.
   */
  private static getLocalCoordinate(
    local: Coordinate,
    axis: Axis,
    order: int32
  ): float64 {
    /* Do we have an axis? */
    if (axis != null) order = axis.getOrder();
    /* Return the request coordinate */
    if (order == 1) return local.getX();
    if (order == 2) return local.getY();
    if (order == 3) return local.getZ();
    return 0.0;
  }

  /**
   * Convert a coordinate from the local to the standard form.
   * @param local the local coordinate (input).
   * @param standard the standard coordinate (can be same as local) (output).
   */
  public localToStandard(local: Coordinate, standard: Coordinate): void {
    /* Get X */
    let x: float64 = CoordinateSystem.getLocalCoordinate(local, this._xAxis, 1);
    if (this._xUnit != null) x = this._xUnit.toStandard(x);
    /* Get Y */
    let y: float64 = CoordinateSystem.getLocalCoordinate(local, this._yAxis, 2);
    if (this._yUnit != null) y = this._yUnit.toStandard(y);
    /* Get Z */
    let z: float64 = CoordinateSystem.getLocalCoordinate(local, this._zAxis, 3);
    if (this._zUnit != null) z = this._zUnit.toStandard(z);
    /* Set */
    standard.setX(x);
    standard.setY(y);
    standard.setZ(z);
  }

  /**
   * Get a standard coordinate.
   * @param x the standard x coordinate.
   * @param y the standard y coordinate.
   * @param z the standard z coordinate.
   * @param axis the local axis to consider.
   * @param index the default index.
   * @return the coordinate.
   */
  private getStandardCoordinate(
    x: float64,
    y: float64,
    z: float64,
    axis: Axis,
    index: int32
  ): float64 {
    /* Check the standard index of the axis */
    if (axis == this._xAxis) index = 1;
    else if (axis == this._yAxis) index = 2;
    else if (axis == this._zAxis) index = 3;
    /* Return the coordinate */
    if (index == 1) return x;
    if (index == 2) return y;
    if (index == 3) return z;
    return 0.0;
  }

  /**
   * Convert a coordinate from the standard to the local form.
   * @param standard the standard coordinate (input).
   * @param local the local coordinate (can be same as standard) (output).
   */
  public standardToLocal(standard: Coordinate, local: Coordinate): void {
    /* Get X */
    let x: float64 = standard.getX();
    if (this._xUnit != null) x = this._xUnit.fromStandard(x);
    /* Get Y */
    let y: float64 = standard.getY();
    if (this._yUnit != null) y = this._yUnit.fromStandard(y);
    /* Get Z */
    let z: float64 = standard.getZ();
    if (this._zUnit != null) z = this._zUnit.fromStandard(z);
    /* Set */
    local.setX(this.getStandardCoordinate(x, y, z, this._axes.get(0), 1));
    local.setY(this.getStandardCoordinate(x, y, z, this._axes.get(1), 2));
    if (this._axes.size() >= 3)
      local.setZ(this.getStandardCoordinate(x, y, z, this._axes.get(2), 3));
  }
}
