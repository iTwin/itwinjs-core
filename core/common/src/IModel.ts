/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { assert, BeEvent, GeoServiceStatus, GuidString, Id64, Id64String, IModelStatus, Mutable, OpenMode } from "@itwin/core-bentley";
import {
  Angle, AxisIndex, AxisOrder, Constant, Geometry, Matrix3d, Point3d, Range3d, Range3dProps, Transform, TransformProps, Vector3d, XYAndZ, XYZProps,
  YawPitchRollAngles, YawPitchRollProps,
} from "@itwin/core-geometry";
import { ChangesetIdWithIndex } from "./ChangesetProps";
import { Cartographic, CartographicProps } from "./geometry/Cartographic";
import { GeographicCRS, GeographicCRSProps } from "./geometry/CoordinateReferenceSystem";
import { AxisAlignedBox3d } from "./geometry/Placement";
import { IModelError } from "./IModelError";
import { ThumbnailProps } from "./Thumbnail";

/** The properties to open a connection to an iModel for RPC operations.
 * @public
 */
export interface IModelRpcOpenProps {
  /** The iTwin in which the iModel exists - must be defined for briefcases that are synchronized with iModelHub. */
  readonly iTwinId?: GuidString;
  /** Guid of the iModel. */
  readonly iModelId?: GuidString;

  /** Id of the last Changeset that was applied to the iModel - must be defined for briefcases that are synchronized with iModelHub.
   * @note Changeset Ids are string hash values based on the content and parent.
   */
  readonly changeset?: ChangesetIdWithIndex;
}

/** The properties that identify an opened iModel for RPC operations.
 * @public
 */
export interface IModelRpcProps extends IModelRpcOpenProps {
  /** Unique key used for identifying the iModel between the frontend and the backend */
  readonly key: string;
}

/** Properties that position an iModel on the earth via [ECEF](https://en.wikipedia.org/wiki/ECEF) (Earth Centered Earth Fixed) coordinates
 * The origin is specified as an ECEF coordinate. The cartographicOrigin property contains the latitude, longitude and elevation above the WGS84 ellipsoid
 * of the origin property. This cartographicOrigin is offered as a convenient pre-calculated value representing the location of the ECEF origin.
 * The 3D coordinate system this class represents is positioned at specified origin and the axis positioned according to
 * the other properties.
 * If transform property is defined then it will not be computed from other properties.
 * If the xVector and yVector properties are defined (and transform is not defined) then they take precedence over the YawPitchRoll orientation property. The xVector and yVector
 * represent the direction and scale of the X and Y axes. The Z axis is always perpendicular (according to the right hand rule) to these X-Y axes.
 * The scaling in the Z direction is always unity. The scale of the X and Y axes is represented by the size of the vector length.
 * If the xVector and yVector are not present then the YawPitchRoll properties indicates the angles for all tree axes. Scaling in that case
 * is unity in all three directions.
 * Note that the present class is intended to represent geolocated 3D coordinate systems that are normally tangent to the WGS84 ellipsoid
 * possibly offset in altitude by the terrain elevation above the ellipsoid but other general 3D coordinate systems
 * can be defined.
 * @public
 * @extensions
 */
export interface EcefLocationProps {
  /** The Origin of an iModel on the earth in ECEF coordinates */
  readonly origin: XYZProps;
  /** The [orientation](https://en.wikipedia.org/wiki/Geographic_coordinate_conversion) of an iModel on the earth. */
  readonly orientation: YawPitchRollProps;
  /** Optional position on the earth used to establish the ECEF coordinates. */
  readonly cartographicOrigin?: CartographicProps;
  /** Optional X column vector used with [[yVector]] to calculate potentially non-rigid transform if a projection is present. */
  readonly xVector?: XYZProps;
  /** Optional Y column vector used with [[xVector]] to calculate potentially non-rigid transform if a projection is present. */
  readonly yVector?: XYZProps;
  /** Optional potentially non-rigid transform defining the ECEF location.
   * @note If this property is supplied, the other properties are ignored.
   */
  readonly transform?: TransformProps;
}

/** Properties of the [Root Subject]($docs/bis/guide/references/glossary#subject-root).
 * @public
 * @extensions
 */
export interface RootSubjectProps {
  /** The name of the root subject. */
  readonly name: string;
  /** Description of the root subject (optional). */
  readonly description?: string;
}

/** Properties of an iModel that are always held in memory whenever one is opened, both on the frontend and on the backend .
 * @public
 */
export interface IModelProps {
  /** The name and description of the root subject of this iModel */
  readonly rootSubject: RootSubjectProps;
  /** The volume of the entire project, in spatial coordinates */
  readonly projectExtents?: Range3dProps;
  /** An offset to be applied to all spatial coordinates. This is normally used to transform spatial coordinates into the Cartesian coordinate system of a Geographic Coordinate System. */
  readonly globalOrigin?: XYZProps;
  /** The location of the iModel in Earth Centered Earth Fixed coordinates. iModel units are always meters */
  readonly ecefLocation?: EcefLocationProps;
  /** The Geographic Coordinate Reference System indicating the projection and datum used. */
  readonly geographicCoordinateSystem?: GeographicCRSProps;
  /** The name of the iModel. */
  readonly name?: string;
}

/** The properties returned by the backend when creating a new [[IModelConnection]] from the frontend, either with Rpc or with Ipc.
 * These properties describe the iModel held on the backend for thew newly formed connection and are used to construct a new
 * [[IModelConnection]] instance on the frontend to access it.
 * @public
 */
export type IModelConnectionProps = IModelProps & IModelRpcProps;

/** The properties that can be supplied when creating a *new* iModel.
 * @public
 */
export interface CreateIModelProps extends IModelProps {
  /** The GUID of new iModel. If not present, a GUID will be generated. */
  readonly guid?: GuidString;
  /** Client name for new iModel */
  readonly client?: string;
  /** Thumbnail for new iModel
   * @alpha
   */
  readonly thumbnail?: ThumbnailProps;
}

/**
 * Encryption-related properties that can be supplied when creating or opening snapshot iModels.
 * @public
 * @deprecated in 3.x. **NOTE**, encrypted iModels are no longer supported since they require licensed code.
 */
export interface IModelEncryptionProps {
  /** The password used to encrypt/decrypt the snapshot iModel. */
  readonly password?: string;
}

/**
 * Sqlite options.
 * @public
 */
export interface OpenSqliteArgs {
  /**
   * Specify timeout after which SQLite stop retrying to acquire lock to database file and throw SQLITE_BUSY error.
   * Timeout is specified in milliseconds.
   * For more information https://www.sqlite.org/c3ref/busy_timeout.html.
   * */
  readonly busyTimeout?: number;
}

/**
 * A key used to identify an opened [IModelDb]($backend) between the frontend and backend for Rpc and Ipc communications.
 * Keys must be unique - that is there can never be two IModelDbs opened with the same key at any given time.
 * If no key is supplied in a call to open an IModelDb, one is generated and returned.
 * It is only necessary to supply a key if you have some reason to assign a specific value to identify an IModelDb.
 * If you don't supply the key, you must use the returned value for Rpc and Ipc communications.
 * @public
 */
export interface OpenDbKey {
  readonly key?: string;
}

/** @beta TODO documentation */
export interface CloudContainerUri {
  readonly uriParams: string;
}

/** Options to open a [SnapshotDb]($backend).
 * @public
 */
export interface SnapshotOpenOptions extends IModelEncryptionProps, OpenDbKey { // eslint-disable-line @typescript-eslint/no-deprecated
  /**
   * The "base" name that can be used for creating temporary files related to this Db.
   * The string should be a name related to the current Db filename using some known pattern so that all files named "baseName*" can be deleted externally during cleanup.
   * It must be the name of a file (that may or may not exist) in a writable directory.
   * If not present, the baseName will default to the database's file name (including the path).
   * @internal
   */
  readonly tempFileBase?: string;
}

/** Options to open a [StandaloneDb]($backend) via [StandaloneDb.openFile]($backend) from the backend,
 * or [BriefcaseConnection.openStandalone]($frontend) from the frontend.
 * @public
 */
export type StandaloneOpenOptions = OpenDbKey;

/** Options that can be supplied when creating snapshot iModels.
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated
export interface CreateSnapshotIModelProps extends IModelEncryptionProps {
  /** If true, then create SQLite views for Model, Element, ElementAspect, and Relationship classes.
   * These database views can often be useful for interoperability workflows.
   */
  readonly createClassViews?: boolean;
}

/** The options that can be specified when creating an *empty* snapshot iModel.
 * @see [SnapshotDb.createEmpty]($backend)
 * @public
 */
export type CreateEmptySnapshotIModelProps = CreateIModelProps & CreateSnapshotIModelProps;

/** Options that can be supplied when creating standalone iModels.
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated
export interface CreateStandaloneIModelProps extends IModelEncryptionProps {
  /** If present, file will allow local editing, but cannot be used to create changesets */
  readonly allowEdit?: string;
}

/** The options that can be specified when creating an *empty* standalone iModel.
 * @see [standalone.createEmpty]($backend)
 * @internal
 */
export type CreateEmptyStandaloneIModelProps = CreateIModelProps & CreateStandaloneIModelProps;

/**
 * @public
 * @extensions
 */
export interface FilePropertyProps {
  readonly namespace: string;
  readonly name: string;
  id?: number | string;
  subId?: number | string;
}

/** The position and orientation of an iModel on the earth in [ECEF](https://en.wikipedia.org/wiki/ECEF) (Earth Centered Earth Fixed) coordinates
 * @note This is an immutable type - all of its properties are frozen.
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
  /** Optional X column vector used with [[yVector]] to calculate potentially non-rigid transform if a projection is present. */
  public readonly xVector?: Vector3d;
  /** Optional Y column vector used with [[xVector]] to calculate potentially non-rigid transform if a projection is present. */
  public readonly yVector?: Vector3d;
  /** The transform from iModel Spatial coordinates to ECEF from this EcefLocation */
  private readonly _transform: Transform = Transform.createIdentity();

  /** Get the transform from iModel Spatial coordinates to ECEF from this EcefLocation */
  public getTransform(): Transform { return this._transform; }

  /** Construct a new EcefLocation. Once constructed, it is frozen and cannot be modified. */
  constructor(props: EcefLocationProps) {
    this.origin = Point3d.fromJSON(props.origin).freeze();
    this.orientation = YawPitchRollAngles.fromJSON(props.orientation).freeze();
    if (props.cartographicOrigin)
      this.cartographicOrigin = Cartographic.fromRadians({ longitude: props.cartographicOrigin.longitude, latitude: props.cartographicOrigin.latitude, height: props.cartographicOrigin.height }).freeze();
    if (props.xVector && props.yVector) {
      this.xVector = Vector3d.fromJSON(props.xVector).freeze();
      this.yVector = Vector3d.fromJSON(props.yVector).freeze();
    }
    if (props.transform) {
      this._transform.setFromJSON(props.transform);
      this._transform.freeze();
    } else {
      let matrix;
      if (this.xVector && this.yVector) {
        const zVector = this.xVector.crossProduct(this.yVector);
        if (zVector.normalizeInPlace())
          matrix = Matrix3d.createColumns(this.xVector, this.yVector, zVector);
      }
      if (!matrix)
        matrix = this.orientation.toMatrix3d();

      this._transform = Transform.createOriginAndMatrix(this.origin, matrix);
      this._transform.freeze();
    }
  }

  /** Returns true if this EcefLocation is not located at the center of the Earth.
   * @alpha are locations very close to the center considered valid? What are the specific criteria?
   */
  public get isValid(): boolean {
    return !this.origin.isZero;
  }

  /** Construct ECEF Location from cartographic origin with optional known point and angle.   */
  public static createFromCartographicOrigin(origin: Cartographic, point?: Point3d, angle?: Angle) {
    const ecefOrigin = origin.toEcef();
    const deltaRadians = 10 / Constant.earthRadiusWGS84.polar;
    const northCarto = Cartographic.fromRadians({ longitude: origin.longitude, latitude: origin.latitude + deltaRadians, height: origin.height });
    const eastCarto = Cartographic.fromRadians({ longitude: origin.longitude + deltaRadians, latitude: origin.latitude, height: origin.height });
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

  /** Construct ECEF Location from transform with optional position on the earth used to establish the ECEF origin and orientation. */
  public static createFromTransform(transform: Transform): EcefLocation {
    const ecefOrigin = transform.getOrigin();
    const angleFromInput = YawPitchRollAngles.createDegrees(0, 0, 0);
    const locationOrientationFromInputT = YawPitchRollAngles.createFromMatrix3d(transform.getMatrix(), angleFromInput);
    const transformProps = transform.toJSON();

    return new EcefLocation({ origin: ecefOrigin, orientation: locationOrientationFromInputT ?? angleFromInput, transform: transformProps });
  }

  /** Get the location center of the earth in the iModel coordinate system. */
  public get earthCenter(): Point3d {
    const matrix = this.orientation.toMatrix3d();
    return Point3d.createFrom(matrix.multiplyTransposeXYZ(-this.origin.x, -this.origin.y, -this.origin.z));
  }

  /** Return true if this location is equivalent to another location within a small tolerance. */
  public isAlmostEqual(other: EcefLocation): boolean {
    if (!this.origin.isAlmostEqual(other.origin) || !this.orientation.isAlmostEqual(other.orientation))
      return false;

    if ((this.xVector === undefined) !== (other.xVector === undefined) || (this.yVector === undefined) !== (other.yVector === undefined))
      return false;

    if (this.xVector !== undefined && other.xVector !== undefined && !this.xVector.isAlmostEqual(other.xVector))
      return false;

    if (this.yVector !== undefined && other.yVector !== undefined && !this.yVector.isAlmostEqual(other.yVector))
      return false;

    if (!this.getTransform().isAlmostEqual(other.getTransform()))
      return false;

    const thisCarto = this.cartographicOrigin;
    const otherCarto = other.cartographicOrigin;
    if (undefined === thisCarto || undefined === otherCarto)
      return undefined === thisCarto && undefined === otherCarto;

    return thisCarto.equalsEpsilon(otherCarto, Geometry.smallMetricDistance);
  }

  public toJSON(): EcefLocationProps {
    const props: Mutable<EcefLocationProps> = {
      origin: this.origin.toJSON(),
      orientation: this.orientation.toJSON(),
      transform: this.getTransform().toJSON(),
    };

    if (this.cartographicOrigin)
      props.cartographicOrigin = this.cartographicOrigin.toJSON();

    if (this.xVector)
      props.xVector = this.xVector.toJSON();

    if (this.yVector)
      props.yVector = this.yVector.toJSON();

    return props;
  }
}

/** Represents an iModel in JavaScript.
 * @see [GeoLocation of iModels]($docs/learning/GeoLocation.md)
 * @public
 */
export abstract class IModel implements IModelProps {
  private _projectExtents?: AxisAlignedBox3d;
  private _name?: string;
  private _rootSubject?: RootSubjectProps;
  private _globalOrigin?: Point3d;
  private _ecefLocation?: EcefLocation;
  private _geographicCoordinateSystem?: GeographicCRS;
  private _iModelId?: GuidString;
  private _changeset: ChangesetIdWithIndex;

  /** The Id of the repository model. */
  public static readonly repositoryModelId: Id64String = "0x1";
  /** The Id of the root subject element. */
  public static readonly rootSubjectId: Id64String = "0x1";
  /** The Id of the dictionary model. */
  public static readonly dictionaryId: Id64String = "0x10";

  /** Event raised after [[name]] changes. */
  public readonly onNameChanged = new BeEvent<(previousName: string) => void>();
  /** Event raised after [[rootSubject]] changes. */
  public readonly onRootSubjectChanged = new BeEvent<(previousSubject: RootSubjectProps) => void>();
  /** Event raised after [[projectExtents]] changes. */
  public readonly onProjectExtentsChanged = new BeEvent<(previousExtents: AxisAlignedBox3d) => void>();
  /** Event raised after [[globalOrigin]] changes. */
  public readonly onGlobalOriginChanged = new BeEvent<(previousOrigin: Point3d) => void>();
  /** Event raised after [[ecefLocation]] changes. */
  public readonly onEcefLocationChanged = new BeEvent<(previousLocation: EcefLocation | undefined) => void>();
  /** Event raised after [[geographicCoordinateSystem]] changes. */
  public readonly onGeographicCoordinateSystemChanged = new BeEvent<(previousGCS: GeographicCRS | undefined) => void>();
  /** Event raised after [[changeset]] changes. */
  public readonly onChangesetChanged = new BeEvent<(previousChangeset: ChangesetIdWithIndex) => void>();

  /** Name of the iModel */
  public get name(): string {
    assert(this._name !== undefined);
    return this._name;
  }
  public set name(name: string) {
    if (name !== this._name) {
      const old = this._name;
      this._name = name;
      if (undefined !== old)
        this.onNameChanged.raiseEvent(old);
    }
  }

  /** The name and description of the root subject of this iModel */
  public get rootSubject(): RootSubjectProps {
    assert(this._rootSubject !== undefined);
    return this._rootSubject;
  }
  public set rootSubject(subject: RootSubjectProps) {
    if (undefined === this._rootSubject || this._rootSubject.name !== subject.name || this._rootSubject.description !== subject.description) {
      const old = this._rootSubject;
      this._rootSubject = subject;
      if (old)
        this.onRootSubjectChanged.raiseEvent(old);
    }
  }

  /** Returns `true` if this is a snapshot iModel. */
  public abstract get isSnapshot(): boolean;
  /** Returns `true` if this is a briefcase copy of an iModel that is synchronized with iModelHub. */
  public abstract get isBriefcase(): boolean;

  public abstract get isOpen(): boolean;

  /**
   * The volume, in spatial coordinates, inside which the entire project is contained.
   * @note The object returned from this method is frozen. You *must* make a copy before you do anything that might attempt to modify it.
   */
  public get projectExtents() {
    assert(undefined !== this._projectExtents);
    return this._projectExtents;
  }
  public set projectExtents(extents: AxisAlignedBox3d) {
    // Don't allow any axis of the project extents to be less than 1 meter.
    const projectExtents = extents.clone();
    projectExtents.ensureMinLengths(1.0);
    if (!this._projectExtents || !this._projectExtents.isAlmostEqual(projectExtents)) {
      const old = this._projectExtents;
      projectExtents.freeze();
      this._projectExtents = projectExtents;
      if (old)
        this.onProjectExtentsChanged.raiseEvent(old);
    }
  }

  /** An offset to be applied to all spatial coordinates. */
  public get globalOrigin(): Point3d {
    assert(this._globalOrigin !== undefined);
    return this._globalOrigin;
  }
  public set globalOrigin(org: Point3d) {
    if (!this._globalOrigin || !this._globalOrigin.isAlmostEqual(org)) {
      const old = this._globalOrigin;
      org.freeze();
      this._globalOrigin = org;
      if (old)
        this.onGlobalOriginChanged.raiseEvent(old);
    }
  }

  /** The [EcefLocation]($docs/learning/glossary#ecefLocation) of the iModel in Earth Centered Earth Fixed coordinates.
   * If the iModel property geographicCoordinateSystem is not defined then the ecefLocation provides a geolocation by defining a
   * 3D coordinate system relative to the Earth model WGS84. Refer to additional documentation for details. If the geographicCoordinateSystem
   * property is defined then the ecefLocation must be used with care. When the geographicCoordinateSystem is defined it indicates the
   * iModel cartesian space is the result of a cartographic projection. This implies a flattening of the Earth surface process that
   * results in scale, angular or area distortion. The ecefLocation is then an approximation calculated at the center of the project extent.
   * If the project is more than 2 kilometer in size, the ecefLocation may represent a poor approximation of the effective
   * cartographic projection used and a linear transformation should then be calculated at the exact origin of the data
   * it must position.
   * @see [GeoLocation of iModels]($docs/learning/GeoLocation.md)
  */
  public get ecefLocation(): EcefLocation | undefined {
    return this._ecefLocation;
  }
  public set ecefLocation(ecefLocation: EcefLocation | undefined) {
    const old = this._ecefLocation;
    if (!old && !ecefLocation)
      return;
    else if (old && ecefLocation && old.isAlmostEqual(ecefLocation))
      return;

    this._ecefLocation = ecefLocation;
    this.onEcefLocationChanged.raiseEvent(old);
  }

  /** Set the [EcefLocation]($docs/learning/glossary#ecefLocation) for this iModel. */
  public setEcefLocation(ecef: EcefLocationProps): void {
    this.ecefLocation = new EcefLocation(ecef);
  }

  /** The geographic coordinate reference system of the iModel. */
  public get geographicCoordinateSystem(): GeographicCRS | undefined {
    return this._geographicCoordinateSystem;
  }
  public set geographicCoordinateSystem(geoCRS: GeographicCRS | undefined) {
    const old = this._geographicCoordinateSystem;
    if (!old && !geoCRS)
      return;
    else if (old && geoCRS && old.equals(geoCRS))
      return;

    this._geographicCoordinateSystem = geoCRS;
    this.onGeographicCoordinateSystemChanged.raiseEvent(old);
  }

  /** Sets the geographic coordinate reference system from GeographicCRSProps. */
  public setGeographicCoordinateSystem(geoCRS: GeographicCRSProps) {
    this.geographicCoordinateSystem = new GeographicCRS(geoCRS);
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
      ... this._getRpcProps(),
    };
  }

  /** Convert this iModel to a JSON representation. */
  public toJSON(): IModelConnectionProps {
    return this.getConnectionProps();
  }

  /** A key used to identify this iModel in RPC calls from frontend to backend.
   * @internal
   */
  protected _fileKey: string;
  /** Get the key that was used to open this iModel. This is the value used for Rpc and Ipc communications. */
  public get key(): string { return this._fileKey; }

  /** @internal */
  protected _iTwinId?: GuidString;
  /** The Guid that identifies the iTwin that owns this iModel. */
  public get iTwinId(): GuidString | undefined { return this._iTwinId; }

  /** The Guid that identifies this iModel. */
  public get iModelId(): GuidString | undefined { return this._iModelId; }

  /** @public */
  public get changeset(): ChangesetIdWithIndex {
    return { ...this._changeset };
  }
  public set changeset(changeset: ChangesetIdWithIndex) {
    const prev = this._changeset;
    if (prev.id !== changeset.id || prev.index !== changeset.index) {
      this._changeset = { id: changeset.id, index: changeset.index };
      this.onChangesetChanged.raiseEvent(prev);
    }
  }

  protected _openMode = OpenMode.Readonly;
  /** The [[OpenMode]] used for this IModel. */
  public get openMode(): OpenMode { return this._openMode; }

  /** Return a token for RPC operations.
   * @throws IModelError if the iModel is not open.
   */
  public getRpcProps(): IModelRpcProps {
    if (!this.isOpen)
      throw new IModelError(IModelStatus.BadRequest, "IModel is not open for rpc");

    return this._getRpcProps();
  }

  /** Returns the iModel's RPC properties.
   * @note It is an error to attempt to use these properties as a token for RPC operations if the iModel is not open.
   * @internal
   */
  protected _getRpcProps(): IModelRpcProps {
    return {
      key: this._fileKey,
      iTwinId: this.iTwinId,
      iModelId: this.iModelId,
      changeset: this.changeset,
    };
  }

  /** @internal */
  protected constructor(tokenProps?: IModelRpcProps) {
    this._changeset = tokenProps?.changeset ?? { id: "", index: 0 };
    this._fileKey = "";
    if (tokenProps) {
      this._fileKey = tokenProps.key;
      this._iTwinId = tokenProps.iTwinId;
      this._iModelId = tokenProps.iModelId;
    }
  }

  /** @internal */
  protected initialize(name: string, props: IModelProps) {
    this.name = name;
    this.rootSubject = props.rootSubject;
    this.projectExtents = Range3d.fromJSON(props.projectExtents);
    this.globalOrigin = Point3d.fromJSON(props.globalOrigin);

    const ecefLocation = props.ecefLocation ? new EcefLocation(props.ecefLocation) : undefined;
    this.ecefLocation = ecefLocation?.isValid ? ecefLocation : undefined;

    this.geographicCoordinateSystem = props.geographicCoordinateSystem ? new GeographicCRS(props.geographicCoordinateSystem) : undefined;
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
    return this._ecefLocation.getTransform();
  }

  /** Convert a point in this iModel's Spatial coordinates to an ECEF point using its [[IModel.ecefLocation]].
   * @param spatial A point in the iModel's spatial coordinates
   * @param result If defined, use this for output
   * @returns A Point3d in ECEF coordinates
   * @throws IModelError if [[isGeoLocated]] is false.
   */
  public spatialToEcef(spatial: XYAndZ, result?: Point3d): Point3d { return this.getEcefTransform().multiplyPoint3d(spatial, result); }

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
