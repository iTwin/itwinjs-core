/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module iModels */

import { Id64, GuidProps, IModelStatus } from "@bentley/bentleyjs-core";
import { Point3d, XYZProps, Range3dProps, YawPitchRollProps, YawPitchRollAngles, Transform, XYAndZ } from "@bentley/geometry-core";
import { AxisAlignedBox3d } from "./geometry/Primitives";
import { ThumbnailProps } from "./Thumbnail";
import { IModelError } from "./IModelError";
import { Cartographic } from "./geometry/Cartographic";

/** A token that identifies a specific instance of an iModel to be operated on */
export class IModelToken {
  /** Constructor */
  public constructor(
    /** Key used for identifying the iModel on the backend */
    public readonly key?: string,
    /** Context (Project, Asset, or other infrastructure) in which the iModel exists - must be defined if the iModel exists in the Hub or in a non-Connect infrastructure. */
    public readonly contextId?: string,
    /** Guid of the iModel - must be defined if the iModel exists in the Hub */
    public readonly iModelId?: string,
    /** Id of the last ChangeSet that was applied to the iModel - must be defined if the iModel exists in the Hub */
    public changeSetId?: string,
  ) {
  }
}

/** Properties that position an iModel on the earth via [ECEF](https://en.wikipedia.org/wiki/ECEF) (Earth Centered Earth Fixed) coordinates */
export interface EcefLocationProps {
  /** The Origin of an iModel on the earth in ECEF coordinates */
  origin: XYZProps;
  /** The [orientation](https://en.wikipedia.org/wiki/Geographic_coordinate_conversion) of an iModel on the earth. See */
  orientation: YawPitchRollProps;
}

/** The position and orientation of an iModel on the earth in [ECEF](https://en.wikipedia.org/wiki/ECEF) (Earth Centered Earth Fixed) coordinates */
export class EcefLocation implements EcefLocationProps {
  /** The origin of the ECEF transform. */
  public readonly origin: Point3d;
  /** The orientation of the ECEF transform */
  public readonly orientation: YawPitchRollAngles;
  /** Get the transform from iModel Spatial coordinates to ECEF from this EcefLocation */
  public getTransform(): Transform { return Transform.createOriginAndMatrix(this.origin, this.orientation.toRotMatrix()); }

  /** Construct a new EcefLocation. Once constructed, it is frozen and cannot be modified. */
  constructor(props: EcefLocationProps) {
    this.origin = Point3d.fromJSON(props.origin);
    this.orientation = YawPitchRollAngles.fromJSON(props.orientation);
    this.origin.freeze(); // may not be modified
    this.orientation.freeze(); // may not be modified
  }
}

/** Properties of the [Root Subject]($docs/bis/intro/glossary#subject-root). */
export interface RootSubjectProps {
  /** The name of the root subject. */
  name: string;
  /** Description of the root subject (optional). */
  description?: string;
}

/** Properties that are about an iModel. */
export interface IModelProps {
  /** The name and description of the root subject of this iModel */
  rootSubject: RootSubjectProps;
  /** The volume of the entire project, in spatial coordinates */
  projectExtents?: Range3dProps;
  /** An offset to be applied to all spatial coordinates. This is normally used to transform spatial coordinates into the Cartesian coordinate system of a Geographic Coordinate System. */
  globalOrigin?: XYZProps;
  /** The location of the iModel in Earth Centered Earth Fixed coordinates. iModel units are always meters */
  ecefLocation?: EcefLocationProps;
}

/** The properties that can be supplied when creating a *new* iModel. */
export interface CreateIModelProps extends IModelProps {
  /** The GUID of new iModel. If not present, a GUID will be generated. */
  guid?: GuidProps;
  /** Client name for new iModel */
  client?: string;
  /** Thumbnail for new iModel */
  thumbnail?: ThumbnailProps;
}

export interface FilePropertyProps {
  namespace: string;
  name: string;
  id?: number;
  subId?: number;
}

/** Represents an iModel in JavaScript. */
export abstract class IModel implements IModelProps {
  /** The Id of the repository model. */
  public static readonly repositoryModelId = new Id64("0x1");
  /** The Id of the root subject element. */
  public static readonly rootSubjectId = new Id64("0x1");
  /** The Id of the dictionary model. */
  public static readonly dictionaryId = new Id64("0x10");
  /** Name of the iModel */
  public name!: string;
  /** The name and description of the root subject of this iModel */
  public rootSubject!: RootSubjectProps;

  private _projectExtents!: AxisAlignedBox3d;
  /**
   * The volume, in spatial coordinates, inside which the entire project is contained.
   * @note The object returned from this method is frozen. You *must* make a copy before you do anything that might attempt to modify it.
   */
  public get projectExtents() { return this._projectExtents; }
  public set projectExtents(extents: AxisAlignedBox3d) {
    this._projectExtents = extents.clone();
    this._projectExtents.ensureMinLengths(1.0);  // don't allow any axis of the project extents to be less than 1 meter.
    this._projectExtents.freeze();
  }

  private _globalOrigin!: Point3d;
  /** An offset to be applied to all spatial coordinates. */
  public get globalOrigin(): Point3d { return this._globalOrigin; }

  private _ecefLocation?: EcefLocation;
  private _ecefTrans?: Transform;

  /** The [EcefLocation]($docs/learning/glossary#ecefLocation) of the iModel in Earth Centered Earth Fixed coordinates. */
  public get ecefLocation(): EcefLocation | undefined { return this._ecefLocation; }

  /** Set the [EcefLocation]($docs/learning/glossary#ecefLocation) for this iModel. */
  public setEcefLocation(ecef: EcefLocationProps) {
    this._ecefLocation = new EcefLocation(ecef);
    this._ecefTrans = undefined;
  }

  /** @hidden */
  public toJSON(): IModelProps {
    const out: any = {};
    out.name = this.name;
    out.rootSubject = this.rootSubject;
    out.projectExtents = this.projectExtents.toJSON();
    out.globalOrigin = this.globalOrigin.toJSON();
    out.ecefLocation = this.ecefLocation;
    out.iModelToken = this.iModelToken;
    return out;
  }

  /** @hidden */
  protected token: IModelToken;

  /** The token that can be used to find this iModel instance. */
  public get iModelToken(): IModelToken { return this.token; }

  /** @hidden */
  protected constructor(iModelToken: IModelToken) { this.token = iModelToken; }

  /** @hidden */
  protected initialize(name: string, props: IModelProps) {
    this.name = name;
    this.rootSubject = props.rootSubject;
    this.projectExtents = AxisAlignedBox3d.fromJSON(props.projectExtents);
    this._globalOrigin = Point3d.fromJSON(props.globalOrigin);
    this._globalOrigin.freeze(); // cannot be modified
    if (props.ecefLocation)
      this.setEcefLocation(props.ecefLocation);
  }

  /** Get the default subCategoryId for the supplied categoryId */
  public static getDefaultSubCategoryId(categoryId: Id64): Id64 { return categoryId.isValid() ? new Id64([categoryId.getLow() + 1, categoryId.getHigh()]) : new Id64(); }

  /** True if this iModel has an [EcefLocation]($docs/learning/glossary#ecefLocation). */
  public get isGeoLocated() { return undefined !== this._ecefLocation; }

  /** Get the Transform from this iModel's Spatial coordinates to ECEF coordinates using its [[IModel.ecefLocation]].
   * @throws IModelError if [[isGeoLocated]] is false.
   */
  public getEcefTransform(): Transform {
    if (undefined === this._ecefLocation)
      throw new IModelError(IModelStatus.NoGeoLocation, "iModel is not GeoLocated");

    if (this._ecefTrans === undefined) {
      this._ecefTrans = this._ecefLocation.getTransform();
      this._ecefTrans.freeze();
    }

    return this._ecefTrans;
  }

  /**
   * Convert a point in this iModel's Spatial coordinates to an ECEF point using its [[IModel.ecefLocation]].
   * @param spatial A point in the iModel's spatial coordinates
   * @param result If defined, use this for output
   * @returns A Point3d in ECEF coordinates
   * @throws IModelError if [[isGeoLocated]] is false.
   */
  public spatialToEcef(spatial: XYAndZ, result?: Point3d): Point3d { return this.getEcefTransform().multiplyPoint3d(spatial, result)!; }

  /**
   * Convert a point in ECEF coordinates to a point in this iModel's Spatial coordinates using its [[ecefLocation]].
   * @param ecef A point in ECEF coordinates
   * @param result If defined, use this for output
   * @returns A Point3d in this iModel's spatial coordinates
   * @throws IModelError if [[isGeoLocated]] is false.
   * @note The resultant point will only be meaningful if the ECEF coordinate is close on the earth to the iModel.
   */
  public ecefToSpatial(ecef: XYAndZ, result?: Point3d): Point3d { return this.getEcefTransform().multiplyInversePoint3d(ecef, result)!; }

  /**
   * Convert a point in this iModel's Spatial coordinates to a [[Cartographic]]  using its [[IModel.ecefLocation]].
   * @param spatial A point in the iModel's spatial coordinates
   * @param result If defined, use this for output
   * @returns A Cartographic location
   * @throws IModelError if [[isGeoLocated]] is false.
   */
  public spatialToCartographic(spatial: XYAndZ, result?: Cartographic): Cartographic { return Cartographic.fromEcef(this.spatialToEcef(spatial), result)!; }

  /**
   * Convert a [[Cartographic]] to a point in this iModel's Spatial coordinates using its [[IModel.ecefLocation]].
   * @param cartographic A cartographic location
   * @param result If defined, use this for output
   * @returns A point in this iModel's spatial coordinates
   * @throws IModelError if [[isGeoLocated]] is false.
   * @note The resultant point will only be meaningful if the ECEF coordinate is close on the earth to the iModel.
   */
  public cartographicToSpatial(cartographic: Cartographic, result?: Point3d) { return this.ecefToSpatial(cartographic.toEcef(result), result); }
}
