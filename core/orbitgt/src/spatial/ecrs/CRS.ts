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
import { ASystem } from "../../system/runtime/ASystem";
import { Strings } from "../../system/runtime/Strings";
import { Coordinate } from "../geom/Coordinate";
import { Axis } from "./Axis";
import { CoordinateSystem } from "./CoordinateSystem";
import { Datum } from "./Datum";
import { Ellipsoid } from "./Ellipsoid";
import { Operation } from "./Operation";
import { OperationMethod } from "./OperationMethod";
import { Registry } from "./Registry";
import { Transform } from "./Transform";
import { Unit } from "./Unit";
import { VerticalModel } from "./VerticalModel";

/**
 * Class CRS defines the parameters of a coordinate reference system.
 * NOTE: geographic (lon-lat) CRSs have their coordinates in degrees (0..360) instead of radians (0..2PI).
 * NOTE: geocentric (ECEF) CRSs have their coordinates in meters.
 *
 * Based on the following document:
 *
 * Coordinate Conversions and Transformations including Formulas
 * Guidance Note Number 7, part 2
 * Revised May 2005
 * Available at: http://www.epsg.org/
 *
 * @version 1.0 July 2005
 */
/** @internal */
export class CRS {
  /** The type of a compound CRS */
  public static readonly COMPOUND: int32 = 1;
  /** The type of a engineering CRS */
  public static readonly ENGINEERING: int32 = 2;
  /** The type of a geocentric CRS */
  public static readonly GEOCENTRIC: int32 = 3;
  /** The type of a geographic-2D CRS */
  public static readonly GEOGRAPHIC_2D: int32 = 4;
  /** The type of a geographic-3D CRS */
  public static readonly GEOGRAPHIC_3D: int32 = 5;
  /** The type of a projected CRS */
  public static readonly PROJECTED: int32 = 6;
  /** The type of a vertical CRS */
  public static readonly VERTICAL: int32 = 7;

  /** The identification code of the WGS 84 geocentric reference system */
  public static readonly WGS84_GEOCENTRIC_CRS_CODE: int32 = 4978;
  /** The identification code of the WGS 84 3D coordinate reference system */
  public static readonly WGS84_3D_CRS_CODE: int32 = 4979;
  /** The identification code of the WGS 84 2D coordinate reference system */
  public static readonly WGS84_2D_CRS_CODE: int32 = 4326;
  /** The identification code of the WGS 84 datum */
  private static readonly WGS84_DATUM_CODE: int32 = 6326;

  /** The identification code of the WGS 84 geocentric coordinate reference system */
  public static readonly CRS_WGS84_GEOCENTRIC: string = "4978";
  /** The identification code of the WGS 84 geographic coordinate reference system */
  public static readonly CRS_WGS84_3D: string = "4979";
  /** The identification code of the WGS 84 2D coordinate reference system */
  public static readonly CRS_WGS84_2D: string = "4326";

  /** The cache of the WGS 84 geocentric coordinate reference system (4978) */
  private static _CACHE_WGS84_GEOCENTRIC: CRS = null;
  /** The cache of the WGS 84 geographic coordinate reference system (4979) */
  private static _CACHE_WGS84_3D: CRS = null;
  /** The cache of the WGS 84 2D coordinate reference system (4326) */
  private static _CACHE_WGS84_2D: CRS = null;

  /** The code */
  private _code: int32;
  /** The name */
  private _name: string;
  /** The area of use */
  private _area: int32;
  /** The type (PROJECTED,GEOGRAPHIC_2D,GEOGRAPHIC_3D,GEOCENTRIC,VERTICAL,COMPOUND,...) */
  private _type: int32;

  /** The coordinate-system code */
  private _csCode: int32;
  /** The coordinate axes (defined by the csCode) */
  private _axes: AList<Axis>;
  /** The coordinate system (can be null) */
  private _coordinateSystem: CoordinateSystem;
  /** The datum */
  private _datum: Datum;

  /** The base geographic CRS */
  private _baseCRS: CRS;
  /** The projection (from the base CRS to this CRS) */
  private _projection: Operation;

  /** The transformations from the base geocentric CRS to the geocentric WGS (CRS 4326) */
  private _transformationsToWGS: AList<Operation>;
  /** The default transformation from the base geocentric CRS to the geocentric WGS (CRS 4326) */
  private _transformationToWGS: Operation;

  /** The horizontal CRS (type COMPOUND) */
  private _horizontalComponent: CRS;
  /** The vertical CRS (type COMPOUND) */
  private _verticalComponent: CRS;
  /** The vertical model (type VERTICAL) */
  private _verticalModel: VerticalModel;

  /** The text information (WKT) of the CRS */
  private _textForm: string;

  /** The access time of the CRS (for garbage collecting the dynamic CRS) */
  private _accessTime: float64;

  /**
   * Create a new CRS.
   * @param code the code.
   * @param name the name.
   * @param area the area of use.
   * @param type the type.
   * @param csCode the coordinate-system code.
   * @param datum the datum.
   * @param baseCRS the base geographic CRS.
   * @param projection the projection (from the base CRS to this CRS).
   * @param transformationsToWGS the transformations from the base geographic CRS to the WGS 84 datum (of CRS 4326).
   */
  public constructor(
    code: int32,
    name: string,
    area: int32,
    type: int32,
    csCode: int32,
    datum: Datum,
    baseCRS: CRS,
    projection: Operation,
    transformationsToWGS: AList<Operation>
  ) {
    /* Store the parameters */
    this._code = code;
    this._name = name;
    this._area = area;
    this._type = type;
    this._csCode = csCode;
    this._axes = null;
    this._coordinateSystem = null;
    this._datum = datum;
    this._baseCRS = baseCRS;
    this._projection = projection;
    this._transformationsToWGS = transformationsToWGS;
    /* Get the default transform */
    this._transformationToWGS =
      Operation.getLatestTransformation(transformationsToWGS);
    /* Clear */
    this._horizontalComponent = null;
    this._verticalComponent = null;
    this._verticalModel = null;
    this._textForm = null;
    this._accessTime = 0.0;
  }

  /**
   * Create a compound CRS.
   * @param code the code.
   * @param name the name.
   * @param area the area of use.
   * @param horizontalCRS the horizontal CRS.
   * @param verticalCRS the vertical CRS.
   * @return the compound CRS.
   */
  public static createCompound(
    code: int32,
    name: string,
    area: int32,
    horizontalCRS: CRS,
    verticalCRS: CRS
  ): CRS {
    /* Check the parameters */
    ASystem.assertNot(horizontalCRS == null, "No horizontal CRS");
    ASystem.assertNot(verticalCRS == null, "No vertical CRS");
    ASystem.assertNot(
      horizontalCRS.isVertical(),
      "CRS is not horizontal: " + horizontalCRS
    );
    ASystem.assertNot(
      verticalCRS.isVertical() == false,
      "CRS is not vertical: " + verticalCRS
    );
    /* Make the CRS */
    let crs: CRS = new CRS(
      code,
      name,
      area,
      CRS.COMPOUND,
      0 /*csCode*/,
      null /*datum*/,
      null /*baseCRS*/,
      null /*projection*/,
      null /*transformationsToWGS*/
    );
    crs._horizontalComponent = horizontalCRS;
    crs._verticalComponent = verticalCRS;
    /* Return the CRS */
    return crs;
  }

  /**
   * Get the code.
   * @return the code.
   */
  public getCode(): int32 {
    return this._code;
  }

  /**
   * Get the string code.
   * @return the string code.
   */
  public getStringCode(): string {
    return "" + this._code;
  }

  /**
   * Check if a code matches the CRS code.
   * @param code the code.
   * @return true if the code matches.
   */
  public hasStringCode(code: string): boolean {
    return Strings.equals(code, this.getStringCode());
  }

  /**
   * Get the name.
   * @return the name.
   */
  public getName(): string {
    return this._name;
  }

  /**
   * Get the area of use.
   * @return the area.
   */
  public getArea(): int32 {
    return this._area;
  }

  /**
   * Get the type.
   * @return the type.
   */
  public getType(): int32 {
    return this._type;
  }

  /**
   * Get the type label.
   * @return the type label.
   */
  public getTypeLabel(): string {
    return CRS.labelCRSType(this._type);
  }

  /**
   * Is this a geocentric CRS?
   * @return true for a geocentric CRS.
   */
  public isGeoCentric(): boolean {
    return this._type == CRS.GEOCENTRIC;
  }

  /**
   * Is this a geographic CRS?
   * @return true for a projected CRS.
   */
  public isGeoGraphic(): boolean {
    return this._type == CRS.GEOGRAPHIC_2D || this._type == CRS.GEOGRAPHIC_3D;
  }

  /**
   * Is this a geographic 2D CRS?
   * @return true for a projected 2D CRS.
   */
  public isGeoGraphic2D(): boolean {
    return this._type == CRS.GEOGRAPHIC_2D;
  }

  /**
   * Is this a geographic 3D CRS?
   * @return true for a projected 3D CRS.
   */
  public isGeoGraphic3D(): boolean {
    return this._type == CRS.GEOGRAPHIC_3D;
  }

  /**
   * Is this a projected CRS?
   * @return true for a projected CRS.
   */
  public isProjectedType(): boolean {
    return this._type == CRS.PROJECTED;
  }

  /**
   * Is this a projected CRS?
   * @return true for a projected CRS.
   */
  public isProjected(): boolean {
    if (this._type == CRS.COMPOUND)
      return this._horizontalComponent.isProjected();
    return this._type == CRS.PROJECTED;
  }

  /**
   * Is this a vertical CRS?
   * @return true for a vertical CRS.
   */
  public isVertical(): boolean {
    return this._type == CRS.VERTICAL;
  }

  /**
   * Is this a compound CRS?
   * @return true for a compound CRS.
   */
  public isCompound(): boolean {
    return this._type == CRS.COMPOUND;
  }

  /**
   * Get the coordinate-system code.
   * @return the coordinate-system code.
   */
  public getCoordinateSystemCode(): int32 {
    return this._csCode;
  }

  /**
   * Get the coordinate system.
   * @return the coordinate system (can be null if standard).
   */
  public getCoordinateSystem(): CoordinateSystem {
    return this._coordinateSystem;
  }

  /**
   * Get the datum.
   * @return the datum.
   */
  public getDatum(): Datum {
    if (this._datum != null) return this._datum;
    if (this._baseCRS != null) return this._baseCRS.getDatum();
    return null;
  }

  /**
   * Get the code of the datum.
   * @return the code of the datum (0 if there is no datum).
   */
  public getDatumCode(): int32 {
    let datum: Datum = this.getDatum();
    return datum == null ? 0 : datum.getCode();
  }

  /**
   * Set the datum.
   * @param datum the new datum (if null check the base CRS).
   */
  public setDatum(datum: Datum): void {
    this._datum = datum;
  }

  /**
   * Get the ellipsoid.
   * @return the ellipsoid.
   */
  public getEllipsoid(): Ellipsoid {
    return this.getDatum().getEllipsoid();
  }

  /**
   * Get the base geographic CRS.
   * @return the base geographic CRS.
   */
  public getBaseCRS(): CRS {
    return this._baseCRS;
  }

  /**
   * Set the base geographic CRS.
   * @param baseCRS the new base geographic CRS.
   */
  public setBaseCRS(baseCRS: CRS): void {
    this._baseCRS = baseCRS;
  }

  /**
   * Get the coordinate axis of the CRS.
   * @return the coordinate axis of the CRS.
   */
  public getAxes(): AList<Axis> {
    return this._axes;
  }

  /**
   * Set the coordinate axis of the CRS.
   * @param axis the coordinate axis of the CRS.
   */
  public setAxes(axes: AList<Axis>): void {
    /* Store the parameters */
    this._axes = axes;
    /* Update the coordinate system */
    this._coordinateSystem = CoordinateSystem.create(
      this._type,
      this._csCode,
      this._axes
    );
  }

  /**
   * Get the unit code of the first coordinate axis of the CRS.
   * @return the unit code (defaults to METER).
   */
  public getFirstAxisUnitCode(): int32 {
    if (this._type == CRS.COMPOUND)
      return this._horizontalComponent.getFirstAxisUnitCode();
    if (this._axes == null) return Unit.METER;
    if (this._axes.size() == 0) return Unit.METER;
    return this._axes.get(0).getUnitCode();
  }

  /**
   * Get the projection (from the base CRS to this CRS).
   * @return the projection.
   */
  public getProjection(): Operation {
    return this._projection;
  }

  /**
   * Set the projection (from the base CRS to this CRS).
   * @param projection the projection.
   */
  public setProjection(projection: Operation): void {
    this._projection = projection;
  }

  /**
   * Get the projection method (from the base CRS to this CRS).
   * @return the projection method.
   */
  public getProjectionMethod(): OperationMethod {
    if (this._projection == null) return null;
    return this._projection.getMethod();
  }

  /**
   * Get the horizontal component of a compound CRS.
   * @return the horizontal component of a compound CRS.
   */
  public getHorizontalComponent(): CRS {
    /* Check the type */
    ASystem.assertNot(
      this._type != CRS.COMPOUND,
      "CRS " + this._code + " is not compound"
    );
    /* Return the component */
    return this._horizontalComponent;
  }

  /**
   * Check if there is a vertical component (only for type COMPOUND).
   * @return true if there is a vertical component.
   */
  public hasVerticalComponent(): boolean {
    /* Check the type */
    if (this._type != CRS.COMPOUND) return false;
    /* Check the component */
    return this._verticalComponent != null;
  }

  /**
   * Get the vertical component of a compound CRS.
   * @return the vertical component of a compound CRS.
   */
  public getVerticalComponent(): CRS {
    /* Check the type */
    ASystem.assertNot(
      this._type != CRS.COMPOUND,
      "CRS " + this._code + " is not compound"
    );
    /* Return the component */
    return this._verticalComponent;
  }

  /**
   * Get the vertical model (only for type VERTICAL).
   * @return the vertical model.
   */
  public getVerticalModel(): VerticalModel {
    return this._verticalModel;
  }

  /**
   * Set the vertical model (only for type VERTICAL).
   * @param verticalModel the vertical model.
   */
  public setVerticalModel(verticalModel: VerticalModel): void {
    this._verticalModel = verticalModel;
  }

  /**
   * Peek at the transformations from the base geographic CRS to the WGS 84 datum (of CRS 4326).
   * @return the transformations.
   */
  public peekTransformationsToWGS(): AList<Operation> {
    return this._transformationsToWGS;
  }

  /**
   * Get the transformations from the base geographic CRS to the WGS 84 datum (of CRS 4326).
   * @return the transformations.
   */
  public getTransformationsToWGS(): AList<Operation> {
    if (
      this._transformationsToWGS != null &&
      this._transformationsToWGS.size() > 0
    )
      return this._transformationsToWGS;
    if (this._baseCRS != null) return this._baseCRS.getTransformationsToWGS();
    return new AList<Operation>();
  }

  /**
   * Set the transformations from the base geographic CRS to the WGS 84 datum (of CRS 4326).
   * @param transformations the transformations.
   */
  public setTransformationsToWGS(transformations: AList<Operation>): void {
    this._transformationsToWGS = transformations;
  }

  /**
   * Get the default transformation from the base geographic CRS to the WGS 84 datum (of CRS 4326).
   * @return a transformation (null if not available).
   */
  public getTransformationToWGS(): Operation {
    if (this._transformationToWGS != null) return this._transformationToWGS;
    if (this._baseCRS != null) return this._baseCRS.getTransformationToWGS();
    return null;
  }

  /**
   * Set the default transformation from the base geographic CRS to the WGS 84 datum (of CRS 4326).
   * @param transformation a transformation (null if not available).
   */
  public setTransformationToWGS(transformation: Operation): void {
    this._transformationToWGS = transformation;
  }

  /**
   * Convert to a geocentric coordinate.
   * @param local the coordinate in this CRS.
   * @return the geocentric coordinate.
   */
  public toGeoCentric(local: Coordinate): Coordinate {
    /* Projection ? */
    if (this._type == CRS.PROJECTED) {
      /* We need a geographic base CRS */
      ASystem.assertNot(
        this._baseCRS.isGeoGraphic() == false,
        "Projected CRS '" +
          this._code +
          "' needs a geographic base CRS '" +
          this._baseCRS.getCode() +
          "', not '" +
          this._baseCRS.getTypeLabel() +
          "'"
      );
      /* Convert to standard units */
      let projected: Coordinate = local.copy();
      if (this._coordinateSystem != null)
        this._coordinateSystem.localToStandard(projected, projected);
      /* Inverse the projection to get geographic (lon,lat) coordinates (radians) */
      let geographic: Coordinate = new Coordinate(0.0, 0.0, 0.0);
      this._projection.reverse(geographic, projected);
      /* The geographic coordinates are in degrees */
      geographic.setX((geographic.getX() / Math.PI) * 180.0);
      geographic.setY((geographic.getY() / Math.PI) * 180.0);
      /* Let the base CRS calculate the geocentric coordinates */
      return this._baseCRS.toGeoCentric(geographic);
    }
    /* Geocentric ? */
    if (this._type == CRS.GEOCENTRIC) {
      /* Already geocentric */
      return local.copy();
    }
    /* Geographic ? */
    if (this._type == CRS.GEOGRAPHIC_2D || this._type == CRS.GEOGRAPHIC_3D) {
      /* All geographic coordinates are in degrees */
      let geographic: Coordinate = local.copy();
      geographic.setX((geographic.getX() / 180.0) * Math.PI);
      geographic.setY((geographic.getY() / 180.0) * Math.PI);
      /* Convert from geographic (radians) to geocentric */
      let geocentric: Coordinate = new Coordinate(0.0, 0.0, 0.0);
      this._datum.getEllipsoid().toGeoCentric(geographic, geocentric);
      /* Return the geocentric coordinates */
      return geocentric;
    }
    /* We cannot transform */
    ASystem.assertNot(true, "No geocentric transform for " + this);
    return null;
  }

  /**
   * Convert from a geocentric coordinate.
   * @param geocentric the geocentric coordinate.
   * @return the coordinate in this CRS.
   */
  public fromGeoCentric(geocentric: Coordinate): Coordinate {
    /* Projection ? */
    if (this._type == CRS.PROJECTED) {
      /* We need a geographic base CRS */
      ASystem.assertNot(
        this._baseCRS.isGeoGraphic() == false,
        "Projected CRS '" +
          this._code +
          "' needs a geographic base CRS '" +
          this._baseCRS.getCode() +
          "', not '" +
          this._baseCRS.getTypeLabel() +
          "'"
      );
      /* Get the geographic coordinate */
      let geographic: Coordinate = this._baseCRS.fromGeoCentric(geocentric);
      /* The geographic coordinates are in degrees */
      geographic.setX((geographic.getX() / 180.0) * Math.PI);
      geographic.setY((geographic.getY() / 180.0) * Math.PI);
      /* Make the projection */
      let projected: Coordinate = new Coordinate(0.0, 0.0, 0.0);
      this._projection.forward(geographic, projected);
      /* Convert to local units */
      if (this._coordinateSystem != null)
        this._coordinateSystem.standardToLocal(projected, projected);
      /* Return the projected coordinate */
      return projected;
    }
    /* Geocentric ? */
    if (this._type == CRS.GEOCENTRIC) {
      /* Already geocentric */
      return geocentric.copy();
    }
    /* Geographic ? */
    if (this._type == CRS.GEOGRAPHIC_2D || this._type == CRS.GEOGRAPHIC_3D) {
      /* Convert from geocentric to geographic (radians) */
      let geographic: Coordinate = new Coordinate(0.0, 0.0, 0.0);
      this._datum.getEllipsoid().toGeoGraphic(geocentric, geographic);
      /* All geographic coordinates need to be in degrees */
      geographic.setX((geographic.getX() / Math.PI) * 180.0);
      geographic.setY((geographic.getY() / Math.PI) * 180.0);
      /* Return the geographic coordinate */
      return geographic;
    }
    /* We cannot transform */
    ASystem.assertNot(true, "No geocentric transform for " + this);
    return null;
  }

  /**
   * Check if this CRS is a projection of another CRS.
   * @param geographic the geographic CRS to check.
   * @return true if this is a projection of the geographic CRS.
   */
  public isProjectionOf(geographic: CRS): boolean {
    /* This has to be a projection */
    if (this._type != CRS.PROJECTED) return false;
    if (this._projection == null) return false;
    if (this._baseCRS == null) return false;
    /* We need a geographic system */
    if (
      geographic._type != CRS.GEOGRAPHIC_2D &&
      geographic._type != CRS.GEOGRAPHIC_3D
    )
      return false;
    /* Is this our base CRS? */
    return this._baseCRS.isCompatible(geographic);
  }

  /**
   * Convert from a geographic coordinate to a projected coordinate.
   * @param geographic the source geographic coordinate (in degrees).
   * @param projected the target projected coordinate (use null to create a new coordinate).
   * @return the projected coordinate.
   */
  public toProjected(
    geographic: Coordinate,
    projected: Coordinate
  ): Coordinate {
    /* Create target? */
    if (projected == null) projected = new Coordinate(0.0, 0.0, 0.0);
    /* The geographic coordinates are kept in degrees */
    projected.setX((geographic.getX() / 180.0) * Math.PI);
    projected.setY((geographic.getY() / 180.0) * Math.PI);
    projected.setZ(geographic.getZ());
    /* Make the projection */
    this._projection.forward(projected, projected);
    /* Convert to local units */
    if (this._coordinateSystem != null)
      this._coordinateSystem.standardToLocal(projected, projected);
    /* Return the result */
    return projected;
  }

  /**
   * Convert from a projected coordinate to a geographic coordinate.
   * @param projected the source projected coordinate.
   * @param geographic the target geographic coordinate (in degrees) (use null to create a new coordinate).
   * @return the geographic coordinate.
   */
  public fromProjected(
    projected: Coordinate,
    geographic: Coordinate
  ): Coordinate {
    /* Create target? */
    if (geographic == null) geographic = new Coordinate(0.0, 0.0, 0.0);
    /* Convert to standard units */
    let projected2: Coordinate = projected.copy();
    if (this._coordinateSystem != null)
      this._coordinateSystem.localToStandard(projected2, projected2);
    /* Inverse the projection to get the geographic (lon,lat) coordinates (radians) */
    this._projection.reverse(geographic, projected2);
    /* The geographic coordinates are kept in degrees */
    geographic.setX((geographic.getX() / Math.PI) * 180.0);
    geographic.setY((geographic.getY() / Math.PI) * 180.0);
    /* Return the result */
    return geographic;
  }

  /**
   * Get the WGS 84 2D geocentric reference system.
   * @return the WGS 84 2D geocentric reference system.
   */
  private static getWGS84_GeoCentric(): CRS {
    if (CRS._CACHE_WGS84_GEOCENTRIC == null)
      CRS._CACHE_WGS84_GEOCENTRIC = Registry.getCRS2(CRS.CRS_WGS84_GEOCENTRIC);
    return CRS._CACHE_WGS84_GEOCENTRIC;
  }

  /**
   * Get the WGS 84 2D geographic reference system.
   * @return the WGS 84 2D geographic reference system.
   */
  private static getWGS84_3D(): CRS {
    if (CRS._CACHE_WGS84_3D == null)
      CRS._CACHE_WGS84_3D = Registry.getCRS2(CRS.CRS_WGS84_3D);
    return CRS._CACHE_WGS84_3D;
  }

  /**
   * Get the WGS 84 2D coordinate reference system.
   * @return the WGS 84 2D coordinate reference system.
   */
  private static getWGS84_2D(): CRS {
    if (CRS._CACHE_WGS84_2D == null)
      CRS._CACHE_WGS84_2D = Registry.getCRS2(CRS.CRS_WGS84_2D);
    return CRS._CACHE_WGS84_2D;
  }

  /**
   * Is a conversion to and from the WGS 84 coordinate system possible?
   * @return true if possible.
   */
  public isWGSCompatible(): boolean {
    /* Already in WGS ? */
    if (this.getDatum().getCode() == CRS.WGS84_DATUM_CODE) return true;
    /* Get the transformation from the local datum to the WGS datum */
    let localToWGS: Operation = this.getTransformationToWGS();
    if (localToWGS == null) return false;
    /* Compatible */
    return true;
  }

  /**
   * Convert a coordinate to the WGS 84 (geographic 2D) coordinate system.
   * @param source the coordinates in this CRS.
   * @param wgsTransformationIndex the index of the WGS transformation to use (negative for the default transformation).
   * @return the WGS 84 coordinate, x is longitude(-180..+180), y is latitude(-90..+90) and z is height (the z height is the same as the local height).
   */
  public toWGSi(source: Coordinate, wgsTransformationIndex: int32): Coordinate {
    /* Already in the WGS datum ? */
    if (this.getDatum().getCode() == CRS.WGS84_DATUM_CODE) {
      /* Geocentric ? */
      if (this._type == CRS.GEOCENTRIC) {
        /* Convert from geocentric to geographic coordinates */
        let ageographic: Coordinate = new Coordinate(0.0, 0.0, 0.0);
        this._datum
          .getEllipsoid()
          .toGeoGraphic(source /*geocentric*/, ageographic);
        /* The WGS coordinates need to be in degrees */
        ageographic.setX((ageographic.getX() / Math.PI) * 180.0);
        ageographic.setY((ageographic.getY() / Math.PI) * 180.0);
        /* Return the WGS coordinates */
        return ageographic;
      }
      /* Projected ? */
      if (this._projection != null) {
        /* Convert to standard units */
        let projected: Coordinate = source.copy();
        if (this._coordinateSystem != null)
          this._coordinateSystem.localToStandard(projected, projected);
        /* Inverse the projection to go from projected to geographic (lon,lat) coordinates */
        let ageographic: Coordinate = new Coordinate(0.0, 0.0, 0.0);
        this._projection.reverse(ageographic, projected);
        /* The WGS coordinates need to be in degrees */
        ageographic.setX((ageographic.getX() / Math.PI) * 180.0);
        ageographic.setY((ageographic.getY() / Math.PI) * 180.0);
        /* Return the WGS coordinates */
        return ageographic;
      }
      /* Geographic */
      return new Coordinate(source.getX(), source.getY(), source.getZ());
    }
    /* Get the transformation from the local datum to the WGS datum */
    let localToWGS: Operation =
      wgsTransformationIndex < 0
        ? this.getTransformationToWGS()
        : this.getTransformationsToWGS().get(wgsTransformationIndex);
    //        if (localToWGS==null)
    //        {
    //            /* We cannot transform */
    //            ASystem.assert(false,"No datum transformation from "+this+" to WGS");
    //        }
    /* Does the transform work on the projected coordinates (like the OSTN02 grid correction)? */
    let geocentric: Coordinate;
    if (localToWGS != null && localToWGS.getSourceCRS().isProjected()) {
      /* Start with the projected coordinate */
      geocentric = new Coordinate(source.getX(), source.getY(), source.getZ());
    } else {
      /* Calculate the geocentric coordinate */
      geocentric = this.toGeoCentric(
        new Coordinate(source.getX(), source.getY(), source.getZ())
      );
    }
    /* Apply the transform to the WGS datum */
    if (localToWGS != null) localToWGS.forward(geocentric, geocentric);
    /* Get the geographic coordinate */
    let geographic: Coordinate = CRS.getWGS84_2D().fromGeoCentric(geocentric);
    /* Does the transform work on the projected coordinates (like the OSTN02 grid correction)? */
    if (localToWGS != null && localToWGS.getSourceCRS().isProjected()) {
      /* Assume we have the right Z */
    } else {
      /* Restore the original Z (is this allowed??) <ISSUE> */
      geographic.setZ(source.getZ());
    }
    /* Return the WGS geographic coordinates */
    return geographic;
  }

  /**
   * Convert a coordinate to the WGS 84 (geographic 2D) coordinate system.
   * @param source the coordinates in this CRS.
   * @return the WGS 84 coordinate, x is longitude(-180..+180), y is latitude(-90..+90) and z is height (the z height is the same as the local height).
   */
  public toWGS(source: Coordinate): Coordinate {
    return this.toWGSi(source, -1);
  }

  /**
   * Convert from the WGS 84 (geographic 2D) coordinate system to this coordinate system.
   * @param source the coordinates in the WGS 84 coordinate system, where x is longitude(-180..+180), y is latitude(-90..+90) and z is height.
   * @param wgsTransformationIndex the index of the WGS transformation to use (negative for the default transformation).
   * @return the coordinates in this CRS (the z height is the same as the WGS height).
   */
  public fromWGSi(
    source: Coordinate,
    wgsTransformationIndex: int32
  ): Coordinate {
    /* Already in the WGS datum ? */
    if (this.getDatum().getCode() == CRS.WGS84_DATUM_CODE) {
      /* Geocentric ? */
      if (this._type == CRS.GEOCENTRIC) {
        /* Convert to radians */
        let lon: float64 = (source.getX() / 180.0) * Math.PI;
        let lat: float64 = (source.getY() / 180.0) * Math.PI;
        let geographic: Coordinate = new Coordinate(lon, lat, source.getZ());
        /* Convert from geographic to geocentric coordinates */
        let geocentric: Coordinate = new Coordinate(0.0, 0.0, 0.0);
        this._datum.getEllipsoid().toGeoCentric(geographic, geocentric);
        /* Return the geocentric coordinates */
        return geocentric;
      }
      /* Projected ? */
      if (this._projection != null) {
        /* Convert to radians */
        let lon: float64 = (source.getX() / 180.0) * Math.PI;
        let lat: float64 = (source.getY() / 180.0) * Math.PI;
        let geographic: Coordinate = new Coordinate(lon, lat, source.getZ());
        /* Use the projection to go from geographic (lon,lat) coordinates to projected coordinates */
        let projected: Coordinate = new Coordinate(0.0, 0.0, 0.0);
        this._projection.forward(geographic, projected);
        /* Convert to local units */
        if (this._coordinateSystem != null)
          this._coordinateSystem.standardToLocal(projected, projected);
        /* Return the projected coordinates */
        return projected;
      }
      /* Geographic */
      return new Coordinate(source.getX(), source.getY(), source.getZ());
    }
    /* Get the transformation from the local datum to the WGS datum */
    let localToWGS: Operation =
      wgsTransformationIndex < 0
        ? this.getTransformationToWGS()
        : this.getTransformationsToWGS().get(wgsTransformationIndex);
    //        if (localToWGS==null)
    //        {
    //            /* We cannot transform */
    //            ASystem.assert(false,"No datum transformation from "+this+" to WGS");
    //        }
    /* Transform from the WGS datum to the local datum */
    let localGeocentric: Coordinate = CRS.getWGS84_2D().toGeoCentric(
      source /*geographic*/
    );
    if (localToWGS != null)
      localToWGS.reverse(localGeocentric, localGeocentric);
    /* Does the transform work on the projected coordinates (like the OSTN02 grid correction)? */
    if (localToWGS != null && localToWGS.getSourceCRS().isProjected()) {
      /* We already have the result */
      return localGeocentric;
    } else {
      /* Convert from geocentric to local coordinates */
      let local: Coordinate = this.fromGeoCentric(localGeocentric);
      /* Restore the original Z (is this allowed??) <ISSUE> */
      local.setZ(source.getZ());
      /* Return the local coordinates */
      return local;
    }
  }

  /**
   * Convert from the WGS 84 (geographic 2D) coordinate system to this coordinate system.
   * @param source the coordinates in the WGS 84 coordinate system, where x is longitude(-180..+180), y is latitude(-90..+90) and z is height.
   * @return the coordinates in this CRS (the z height is the same as the WGS height).
   */
  public fromWGS(source: Coordinate): Coordinate {
    return this.fromWGSi(source, -1);
  }

  /**
   * Check if another CRS is compatible with this one.
   * @param other the other CRS.
   * @return true if compatible.
   */
  public isCompatible(other: CRS): boolean {
    /* Check the base parameters */
    if (other._code == this._code) return true;
    if (other._type != this._type) return false;
    if (other._csCode != this._csCode) return false;
    /* Geographic? */
    if (this.isGeoCentric() || this.isGeoGraphic()) {
      /* Same datum? */
      if (Datum.areCompatible(other.getDatum(), this.getDatum()) == false)
        return false;
      /* We need the same transformation to WGS (check CRS 2039 for example: wgs compatible datum, but with geocentric translation to wgs) */
      if (
        Operation.isCompatibleOperation(
          other.getTransformationToWGS(),
          this.getTransformationToWGS()
        ) == false
      )
        return false;
      return true;
    } else if (this.isProjected()) {
    /* Projected? */
      /* Same projection? */
      if (
        Operation.isCompatibleOperation(other._projection, this._projection) ==
        false
      )
        return false;
      /* Has base CRS? */
      if (other._baseCRS == null || this._baseCRS == null) return false;
      /* Same base? */
      return other._baseCRS.isCompatible(this._baseCRS);
    } else if (this.isVertical()) {
    /* Vertical? */
      /* Same datum? */
      if (Datum.areCompatible(other.getDatum(), this.getDatum()) == false)
        return false;
      return true;
    } else if (this.isCompound()) {
    /* Compound? */
      /* Same components? */
      if (
        CRS.areCompatible(
          other._horizontalComponent,
          this._horizontalComponent
        ) == false
      )
        return false;
      if (
        CRS.areCompatible(other._verticalComponent, this._verticalComponent) ==
        false
      )
        return false;
      return true;
    } else {
    /* Other */
      return false;
    }
  }

  /**
   * Check if two CRSs are compatible.
   * @param crs1 the first CRS.
   * @param crs2 the second CRS.
   * @return true if compatible.
   */
  public static areCompatible(crs1: CRS, crs2: CRS): boolean {
    if (crs1 == null) return crs2 == null;
    if (crs2 == null) return false;
    return crs1.isCompatible(crs2);
  }

  /**
   * Get the text form of the CRS.
   * @return the text form of the CRS.
   */
  public getTextForm(): string {
    return this._textForm;
  }

  /**
   * Set the text form of the CRS.
   * @param textForm the text form of the CRS.
   */
  public setTextForm(textForm: string): void {
    this._textForm = textForm;
  }

  /**
   * Get the access time.
   * @return the access time.
   */
  public getAccessTime(): float64 {
    return this._accessTime;
  }

  /**
   * Set the access time.
   * @param time the access time.
   */
  public setAccessTime(time: float64): void {
    this._accessTime = time;
  }

  /**
   * The standard toString method.
   * @see Object#toString
   */
  public toString(): string {
    return (
      "[CRS:code=" +
      this._code +
      ",name='" +
      this._name +
      "',area=" +
      this._area +
      ",type='" +
      CRS.labelCRSType(this._type) +
      "',datum=" +
      this._datum +
      ",baseCRS=" +
      this._baseCRS +
      ",wgs-transform=" +
      (this._transformationToWGS != null) +
      "]"
    );
  }

  /**
   * Get the type of a CRS.
   * @param crsKind the type of CRS.
   * @return a parsed type.
   */
  public static parseCRSType(crsKind: string): int32 {
    if (Strings.equalsIgnoreCase(crsKind, "compound")) return CRS.COMPOUND;
    if (Strings.equalsIgnoreCase(crsKind, "engineering"))
      return CRS.ENGINEERING;
    if (Strings.equalsIgnoreCase(crsKind, "geocentric")) return CRS.GEOCENTRIC;
    if (Strings.equalsIgnoreCase(crsKind, "geographic 2D"))
      return CRS.GEOGRAPHIC_2D;
    if (Strings.equalsIgnoreCase(crsKind, "geographic 3D"))
      return CRS.GEOGRAPHIC_3D;
    if (Strings.equalsIgnoreCase(crsKind, "projected")) return CRS.PROJECTED;
    if (Strings.equalsIgnoreCase(crsKind, "vertical")) return CRS.VERTICAL;
    ASystem.assert0(false, "CRS kind '" + crsKind + "' not found");
    return 0;
  }

  /**
   * Get the label of a type of a CRS.
   * @param crsType the type of CRS.
   * @return a label.
   */
  public static labelCRSType(crsType: int32): string {
    if (crsType == CRS.COMPOUND) return "compound";
    if (crsType == CRS.ENGINEERING) return "engineering";
    if (crsType == CRS.GEOCENTRIC) return "geocentric";
    if (crsType == CRS.GEOGRAPHIC_2D) return "geographic 2D";
    if (crsType == CRS.GEOGRAPHIC_3D) return "geographic 3D";
    if (crsType == CRS.PROJECTED) return "projected";
    if (crsType == CRS.VERTICAL) return "vertical";
    ASystem.assert0(false, "CRS type '" + crsType + "' not found");
    return null;
  }
}
