/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */

import { GuidString, Id64, Id64String, IModelStatus, OpenMode } from "@bentley/bentleyjs-core";
import { AxisOrder, Matrix3d, Point3d, Range3dProps, Transform, Vector3d, XYAndZ, XYZProps, YawPitchRollAngles, YawPitchRollProps, Range3d } from "@bentley/geometry-core";
import { Cartographic } from "./geometry/Cartographic";
import { AxisAlignedBox3d } from "./geometry/Placement";
import { IModelError } from "./IModelError";
import { ThumbnailProps } from "./Thumbnail";

/** The properties of IModelToken.
 * @public
 */
export interface IModelTokenProps {
  /** Key used for identifying the iModel on the backend */
  readonly key?: string;
  /** Context (Project, Asset, or other infrastructure) in which the iModel exists - must be defined if the iModel exists in the Hub or in a non-Connect infrastructure. */
  readonly contextId?: string;
  /** Guid of the iModel - must be defined if the iModel exists in the Hub */
  readonly iModelId?: string;
  /** Id of the last ChangeSet that was applied to the iModel - must be defined if the iModel exists in the Hub. An empty string indicates the first version */
  changeSetId?: string;
  /** Mode used to open the iModel */
  openMode?: OpenMode;
}

/** A token that identifies a specific instance of an iModel to be operated on
 * @public
 */
export class IModelToken implements IModelTokenProps {
  /** Constructs an IModelToken from a props object. */
  public static fromJSON(props: IModelTokenProps): IModelToken {
    return new IModelToken(props.key, props.contextId, props.iModelId, props.changeSetId, props.openMode);
  }
  /** Key used for identifying the iModel on the backend */
  public readonly key?: string;
  /** Context (Project, Asset, or other infrastructure) in which the iModel exists - must be defined if the iModel exists in the Hub or in a non-Connect infrastructure. */
  public readonly contextId?: string;
  /** Guid of the iModel - must be defined if the iModel exists in the Hub */
  public readonly iModelId?: string;
  /** Id of the last ChangeSet that was applied to the iModel - must be defined if the iModel exists in the Hub. An empty string indicates the first version */
  public changeSetId?: string;
  /** Mode used to open the iModel */
  public openMode?: OpenMode;

  /** Constructor */
  public constructor(key?: string, contextId?: string, iModelid?: string, changesetId?: string, openMode?: OpenMode) {
    this.key = key;
    this.contextId = contextId;
    this.iModelId = iModelid;
    this.changeSetId = changesetId;
    this.openMode = openMode;
  }

  /** Creates a props object for this IModelToken. */
  public toJSON(): IModelTokenProps {
    return {
      key: this.key,
      contextId: this.contextId,
      iModelId: this.iModelId,
      changeSetId: this.changeSetId,
      openMode: this.openMode,
    };
  }
}

/** Properties that position an iModel on the earth via [ECEF](https://en.wikipedia.org/wiki/ECEF) (Earth Centered Earth Fixed) coordinates
 * @public
 */
export interface EcefLocationProps {
  /** The Origin of an iModel on the earth in ECEF coordinates */
  origin: XYZProps;
  /** The [orientation](https://en.wikipedia.org/wiki/Geographic_coordinate_conversion) of an iModel on the earth. */
  orientation: YawPitchRollProps;
}

/** The position and orientation of an iModel on the earth in [ECEF](https://en.wikipedia.org/wiki/ECEF) (Earth Centered Earth Fixed) coordinates
 * @see [GeoLocation of iModels]($docs/learning/GeoLocation.md)
 * @public
 */
export class EcefLocation implements EcefLocationProps {
  /** The origin of the ECEF transform. */
  public readonly origin: Point3d;
  /** The orientation of the ECEF transform */
  public readonly orientation: YawPitchRollAngles;
  /** Get the transform from iModel Spatial coordinates to ECEF from this EcefLocation */
  public getTransform(): Transform { return Transform.createOriginAndMatrix(this.origin, this.orientation.toMatrix3d()); }

  /** Construct a new EcefLocation. Once constructed, it is frozen and cannot be modified. */
  constructor(props: EcefLocationProps) {
    this.origin = Point3d.fromJSON(props.origin);
    this.orientation = YawPitchRollAngles.fromJSON(props.orientation);
    this.origin.freeze(); // may not be modified
    this.orientation.freeze(); // may not be modified
  }
  /** Construct ECEF Location from cartographic origin.   */
  public static createFromCartographicOrigin(origin: Cartographic) {
    const ecefOrigin = origin.toEcef();
    const zVector = Vector3d.createFrom(ecefOrigin).normalize();
    const xVector = Vector3d.create(-Math.sin(origin.longitude), Math.cos(origin.latitude), 0.0);
    const matrix = Matrix3d.createRigidFromColumns(zVector!, xVector, AxisOrder.ZXY);
    return new EcefLocation({ origin: ecefOrigin, orientation: YawPitchRollAngles.createFromMatrix3d(matrix!)! });
  }
}

/** Properties of the [Root Subject]($docs/bis/intro/glossary#subject-root).
 * @public
 */
export interface RootSubjectProps {
  /** The name of the root subject. */
  name: string;
  /** Description of the root subject (optional). */
  description?: string;
}

/** Properties that are about an iModel.
 * @public
 */
export interface IModelProps {
  /** The name and description of the root subject of this iModel */
  rootSubject: RootSubjectProps;
  /** The volume of the entire project, in spatial coordinates */
  projectExtents?: Range3dProps;
  /** An offset to be applied to all spatial coordinates. This is normally used to transform spatial coordinates into the Cartesian coordinate system of a Geographic Coordinate System. */
  globalOrigin?: XYZProps;
  /** The location of the iModel in Earth Centered Earth Fixed coordinates. iModel units are always meters */
  ecefLocation?: EcefLocationProps;
  /** The name of the iModel. */
  name?: string;
  /** The token of the iModel. */
  iModelToken?: IModelTokenProps;
}

/** The properties that can be supplied when creating a *new* iModel.
 * @public
 */
export interface CreateIModelProps extends IModelProps {
  /** The GUID of new iModel. If not present, a GUID will be generated. */
  guid?: GuidString;
  /** Client name for new iModel */
  client?: string;
  /** Thumbnail for new iModel
   * @alpha
   */
  thumbnail?: ThumbnailProps;
}

/** @public */
export interface FilePropertyProps {
  namespace: string;
  name: string;
  id?: number | string;
  subId?: number | string;
}

/** Represents an iModel in JavaScript.
 * @see [GeoLocation of iModels]($docs/learning/GeoLocation.md)
 * @public
 */
export abstract class IModel implements IModelProps {
  /** The Id of the repository model. */
  public static readonly repositoryModelId: Id64String = "0x1";
  /** The Id of the root subject element. */
  public static readonly rootSubjectId: Id64String = "0x1";
  /** The Id of the dictionary model. */
  public static readonly dictionaryId: Id64String = "0x10";
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

  /** @internal */
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

  /** @internal */
  protected _token: IModelToken;

  /** The token that can be used to find this iModel instance. */
  public get iModelToken(): IModelToken { return this._token; }

  /** @internal */
  protected constructor(iModelToken: IModelToken) { this._token = iModelToken; }

  /** @internal */
  protected initialize(name: string, props: IModelProps) {
    this.name = name;
    this.rootSubject = props.rootSubject;
    this.projectExtents = Range3d.fromJSON(props.projectExtents);
    this._globalOrigin = Point3d.fromJSON(props.globalOrigin);
    this._globalOrigin.freeze(); // cannot be modified
    if (props.ecefLocation)
      this.setEcefLocation(props.ecefLocation);
  }

  /** Get the default subCategoryId for the supplied categoryId */
  public static getDefaultSubCategoryId(categoryId: Id64String): Id64String {
    return Id64.isValid(categoryId) ? Id64.fromLocalAndBriefcaseIds(Id64.getLocalId(categoryId) + 1, Id64.getBriefcaseId(categoryId)) : Id64.invalid;
  }

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
   * Convert a point in this iModel's Spatial coordinates to a [[Cartographic]] using its [[IModel.ecefLocation]].
   * @param spatial A point in the iModel's spatial coordinates
   * @param result If defined, use this for output
   * @returns A Cartographic location
   * @throws IModelError if [[isGeoLocated]] is false.
   */
  public spatialToCartographicFromEcef(spatial: XYAndZ, result?: Cartographic): Cartographic { return Cartographic.fromEcef(this.spatialToEcef(spatial), result)!; }

  /**
   * Convert a [[Cartographic]] to a point in this iModel's Spatial coordinates using its [[IModel.ecefLocation]].
   * @param cartographic A cartographic location
   * @param result If defined, use this for output
   * @returns A point in this iModel's spatial coordinates
   * @throws IModelError if [[isGeoLocated]] is false.
   * @note The resultant point will only be meaningful if the ECEF coordinate is close on the earth to the iModel.
   */
  public cartographicToSpatialFromEcef(cartographic: Cartographic, result?: Point3d) { return this.ecefToSpatial(cartographic.toEcef(result), result); }
}
