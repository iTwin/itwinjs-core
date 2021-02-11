/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { GeoServiceStatus, GuidString, Id64, Id64String, IModelStatus, Logger, OpenMode } from "@bentley/bentleyjs-core";
import { Angle, AxisIndex, AxisOrder, Constant, Matrix3d, Point3d, Range3d, Range3dProps, Transform, Vector3d, XYAndZ, XYZProps, YawPitchRollAngles, YawPitchRollProps } from "@bentley/geometry-core";
import { Cartographic, LatLongAndHeight } from "./geometry/Cartographic";
import { GeographicCRS, GeographicCRSProps } from "./geometry/CoordinateReferenceSystem";
import { AxisAlignedBox3d } from "./geometry/Placement";
import { IModelError } from "./IModelError";
import { ThumbnailProps } from "./Thumbnail";

/** The properties to open a connection to an iModel for RPC operations.
 * @public
 */
export interface IModelRpcOpenProps {
  /** The context (Project, Asset, or other infrastructure) in which the iModel exists - must be defined for briefcases that are synchronized with iModelHub. */
  readonly contextId?: GuidString;
  /** Guid of the iModel. */
  readonly iModelId?: GuidString;
  /** Id of the last ChangeSet that was applied to the iModel - must be defined for briefcases that are synchronized with iModelHub. An empty string indicates the first version */
  changeSetId?: GuidString;
  /** Mode used to open the iModel */
  openMode?: OpenMode;
}

/** The properties that identify an opened iModel for RPC operations.
 * @public
 */
export interface IModelRpcProps extends IModelRpcOpenProps {
  /** Unique key used for identifying the iModel between the frontend and the backend */
  readonly key: string;
}

/** Properties that position an iModel on the earth via [ECEF](https://en.wikipedia.org/wiki/ECEF) (Earth Centered Earth Fixed) coordinates
 * @public
 */
export interface EcefLocationProps {
  /** The Origin of an iModel on the earth in ECEF coordinates */
  origin: XYZProps;
  /** The [orientation](https://en.wikipedia.org/wiki/Geographic_coordinate_conversion) of an iModel on the earth. */
  orientation: YawPitchRollProps;
  /** Optional position on the earth used to establish the ECEF coordinates. */
  cartographicOrigin?: LatLongAndHeight;
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
  /** The Geographic Coordinate Reference System indicating the projection and datum used. */
  geographicCoordinateSystem?: GeographicCRS;
  /** The name of the iModel. */
  name?: string;
}

/** @alpha */
export type IModelConnectionProps = IModelProps & IModelRpcProps;

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

/** Encryption-related properties that can be supplied when creating or opening snapshot iModels.
 * @public
 */
export interface IModelEncryptionProps {
  /** The password used to encrypt/decrypt the snapshot iModel. */
  password?: string;
}

/**
 * A key used to identify an opened IModelDb between the frontend and backend for RPC communications.
 * Keys must be unique - that is there can never be two IModelDbs opened with the same key at any given time.
 * If no key is supplied in a call to open an IModelDb, one is generated and returned.
 * It is only necessary to supply a key if you have some reason to assign a specific value to identify an IModelDb.
 * If you don't supply the key, you must use the returned value for Rpc and Ipc communications.
 * @public
 */
export interface OpenDbKey {
  key?: string;
}

/** Options that can be supplied when opening an existing SnapshotDb.
 * @public
 */
export interface SnapshotOpenOptions extends IModelEncryptionProps, OpenDbKey {
  /** @internal */
  lazyBlockCache?: boolean;
  /** @internal */
  autoUploadBlocks?: boolean;
}

/** Options that can be supplied when opening an existing StandaloneDb.
 * @beta
 */
export type StandaloneOpenOptions = OpenDbKey;

/** Options that can be supplied when creating snapshot iModels.
 * @public
 */
export interface CreateSnapshotIModelProps extends IModelEncryptionProps {
  /** If true, then create SQLite views for Model, Element, ElementAspect, and Relationship classes.
   * These database views can often be useful for interoperability workflows.
   */
  createClassViews?: boolean;
}

/** The options that can be specified when creating an *empty* snapshot iModel.
 * @see [SnapshotDb.createEmpty]($backend)
 * @public
 */
export type CreateEmptySnapshotIModelProps = CreateIModelProps & CreateSnapshotIModelProps;

/** Options that can be supplied when creating standalone iModels.
 * @internal
 */
export interface CreateStandaloneIModelProps extends IModelEncryptionProps {
  /** If present, file will allow local editing, but cannot be used to create changesets */
  allowEdit?: string;
}

/** The options that can be specified when creating an *empty* standalone iModel.
 * @see [standalone.createEmpty]($backend)
 * @internal
 */
export type CreateEmptyStandaloneIModelProps = CreateIModelProps & CreateStandaloneIModelProps;

/** @public */
export interface FilePropertyProps {
  namespace: string;
  name: string;
  id?: number | string;
  subId?: number | string;
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
  /** Optional position on the earth used to establish the ECEF origin and orientation. */
  public readonly cartographicOrigin?: Cartographic;

  /** Get the transform from iModel Spatial coordinates to ECEF from this EcefLocation */
  public getTransform(): Transform {
    return Transform.createOriginAndMatrix(this.origin, this.orientation.toMatrix3d());
  }

  /** Construct a new EcefLocation. Once constructed, it is frozen and cannot be modified. */
  constructor(props: EcefLocationProps) {
    this.origin = Point3d.fromJSON(props.origin).freeze();
    this.orientation = YawPitchRollAngles.fromJSON(props.orientation).freeze();
    if (props.cartographicOrigin)
      this.cartographicOrigin = Cartographic.fromRadians(props.cartographicOrigin.longitude, props.cartographicOrigin.latitude, props.cartographicOrigin.height).freeze();
  }

  /** Construct ECEF Location from cartographic origin with optional known point and angle.   */
  public static createFromCartographicOrigin(origin: Cartographic, point?: Point3d, angle?: Angle) {
    const ecefOrigin = origin.toEcef();
    const deltaRadians = 10 / Constant.earthRadiusWGS84.polar;
    const northCarto = Cartographic.fromRadians(origin.longitude, origin.latitude + deltaRadians, origin.height);
    const eastCarto = Cartographic.fromRadians(origin.longitude + deltaRadians, origin.latitude, origin.height);
    const ecefNorth = northCarto.toEcef();
    const ecefEast = eastCarto.toEcef();
    const xVector = Vector3d.createStartEnd(ecefOrigin, ecefEast).normalize();
    const yVector = Vector3d.createStartEnd(ecefOrigin, ecefNorth).normalize();
    const matrix = Matrix3d.createRigidFromColumns(xVector!, yVector!, AxisOrder.XYZ)!;
    if (angle !== undefined) {
      const north = Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, angle);
      matrix.multiplyMatrixMatrix(north, matrix);
    }
    if (point !== undefined) {
      const delta = matrix.multiplyVector(Vector3d.create(-point.x, -point.y, -point.z));
      ecefOrigin.addInPlace(delta);
    }

    return new EcefLocation({ origin: ecefOrigin, orientation: YawPitchRollAngles.createFromMatrix3d(matrix)!, cartographicOrigin: origin });
  }
  /** Get the location center of the earth in the iModel coordinate system. */
  public get earthCenter(): Point3d {
    const matrix = this.orientation.toMatrix3d();
    return Point3d.createFrom(matrix.multiplyTransposeXYZ(-this.origin.x, -this.origin.y, -this.origin.z));
  }
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

  /** Returns `true` if this is a snapshot iModel. */
  public abstract get isSnapshot(): boolean;
  /** Returns `true` if this is a briefcase copy of an iModel that is synchronized with iModelHub. */
  public abstract get isBriefcase(): boolean;

  public abstract get isOpen(): boolean;

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
  public set globalOrigin(org: Point3d) { org.freeze(); this._globalOrigin = org; }

  private _ecefLocation?: EcefLocation;
  private _ecefTrans?: Transform;

  /** The [EcefLocation]($docs/learning/glossary#ecefLocation) of the iModel in Earth Centered Earth Fixed coordinates. */
  public get ecefLocation(): EcefLocation | undefined { return this._ecefLocation; }

  /** Set the [EcefLocation]($docs/learning/glossary#ecefLocation) for this iModel. */
  public setEcefLocation(ecef: EcefLocationProps): void {
    this._ecefLocation = new EcefLocation(ecef);
    this._ecefTrans = undefined;
  }

  /** The geographic coordinate reference system of the iModel.
   * @alpha
  */
  private _geographicCoordinateSystem?: GeographicCRS;
  public get geographicCoordinateSystem(): GeographicCRS | undefined { return this._geographicCoordinateSystem; }
  public set geographicCoordinateSystem(geoCRS: GeographicCRS | undefined) { this._geographicCoordinateSystem = geoCRS; }
  public setGeographicCoordinateSystem(geoCRS: GeographicCRSProps) {
    this._geographicCoordinateSystem = new GeographicCRS(geoCRS);
  }

  /** @internal */
  public getConnectionProps(): IModelConnectionProps {
    return {
      name: this.name,
      rootSubject: this.rootSubject,
      projectExtents: this.projectExtents.toJSON(),
      globalOrigin: this.globalOrigin.toJSON(),
      ecefLocation: this.ecefLocation,
      geographicCoordinateSystem: this.geographicCoordinateSystem,
      ... this.getRpcProps(),
    };
  }

  /** @internal */
  public toJSON(): IModelConnectionProps {
    return this.getConnectionProps();
  }

  /** A key used to identify this iModel in RPC calls from frontend to backend.
   * @internal
   */
  protected _fileKey: string;
  /** Get the key that was used to open this iModel. This is the value used for Rpc and Ipc communications. */
  public get key() { return this._fileKey; }

  /** @internal */
  protected _contextId?: GuidString;
  /** The Guid that identifies the *context* that owns this iModel. */
  public get contextId(): GuidString | undefined { return this._contextId; }

  private _iModelId?: GuidString;
  /** The Guid that identifies this iModel. */
  public get iModelId(): GuidString | undefined { return this._iModelId; }

  /** @internal */
  protected _changeSetId: string | undefined;
  /** The Id of the last changeset that was applied to this iModel.
   * @note An empty string indicates the first version while `undefined` mean no changeset information is available.
   */
  public get changeSetId() { return this._changeSetId; }

  /** The [[OpenMode]] used for this IModel. */
  public readonly openMode: OpenMode;

  /** Return a token for RPC operations. */
  public getRpcProps(): IModelRpcProps {
    if (!this.isOpen)
      throw new IModelError(IModelStatus.BadRequest, "IModel is not open for rpc", Logger.logError);

    return {
      key: this._fileKey,
      contextId: this.contextId,
      iModelId: this.iModelId,
      changeSetId: this.changeSetId,
      openMode: this.openMode,
    };
  }

  /** @internal */
  protected constructor(tokenProps: IModelRpcProps | undefined, openMode: OpenMode) {
    this._fileKey = tokenProps?.key ?? "";
    this._contextId = tokenProps?.contextId;
    this._iModelId = tokenProps?.iModelId;
    this._changeSetId = tokenProps?.changeSetId;
    this.openMode = openMode; // Note: The open mode passed through the RPC layer is ignored in the case of IModelDb-s
  }

  /** @internal */
  protected initialize(name: string, props: IModelProps) {
    this.name = name;
    this.rootSubject = props.rootSubject;
    this.projectExtents = Range3d.fromJSON(props.projectExtents);
    this.globalOrigin = Point3d.fromJSON(props.globalOrigin);
    if (props.ecefLocation)
      this.setEcefLocation(props.ecefLocation);
    if (props.geographicCoordinateSystem)
      this.setGeographicCoordinateSystem(props.geographicCoordinateSystem);
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
      throw new IModelError(GeoServiceStatus.NoGeoLocation, "iModel is not GeoLocated");
    if (this._ecefTrans === undefined) {
      this._ecefTrans = this._ecefLocation.getTransform();
      this._ecefTrans.freeze();
    }

    return this._ecefTrans;
  }

  /** Convert a point in this iModel's Spatial coordinates to an ECEF point using its [[IModel.ecefLocation]].
   * @param spatial A point in the iModel's spatial coordinates
   * @param result If defined, use this for output
   * @returns A Point3d in ECEF coordinates
   * @throws IModelError if [[isGeoLocated]] is false.
   */
  public spatialToEcef(spatial: XYAndZ, result?: Point3d): Point3d { return this.getEcefTransform().multiplyPoint3d(spatial, result)!; }

  /** Convert a point in ECEF coordinates to a point in this iModel's Spatial coordinates using its [[ecefLocation]].
   * @param ecef A point in ECEF coordinates
   * @param result If defined, use this for output
   * @returns A Point3d in this iModel's spatial coordinates
   * @throws IModelError if [[isGeoLocated]] is false.
   * @note The resultant point will only be meaningful if the ECEF coordinate is close on the earth to the iModel.
   */
  public ecefToSpatial(ecef: XYAndZ, result?: Point3d): Point3d { return this.getEcefTransform().multiplyInversePoint3d(ecef, result)!; }

  /** Convert a point in this iModel's Spatial coordinates to a [[Cartographic]] using its [[IModel.ecefLocation]].
   * @param spatial A point in the iModel's spatial coordinates
   * @param result If defined, use this for output
   * @returns A Cartographic location
   * @throws IModelError if [[isGeoLocated]] is false.
   */
  public spatialToCartographicFromEcef(spatial: XYAndZ, result?: Cartographic): Cartographic { return Cartographic.fromEcef(this.spatialToEcef(spatial), result)!; }

  /** Convert a [[Cartographic]] to a point in this iModel's Spatial coordinates using its [[IModel.ecefLocation]].
   * @param cartographic A cartographic location
   * @param result If defined, use this for output
   * @returns A point in this iModel's spatial coordinates
   * @throws IModelError if [[isGeoLocated]] is false.
   * @note The resultant point will only be meaningful if the ECEF coordinate is close on the earth to the iModel.
   */
  public cartographicToSpatialFromEcef(cartographic: Cartographic, result?: Point3d) { return this.ecefToSpatial(cartographic.toEcef(result), result); }
}
