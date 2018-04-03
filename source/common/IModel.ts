/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode, Id64, GuidProps } from "@bentley/bentleyjs-core";
import { Point3d, XYZProps, Range3dProps, YawPitchRollProps, YawPitchRollAngles } from "@bentley/geometry-core";
import { AxisAlignedBox3d } from "./geometry/Primitives";
import { ThumbnailProps } from "./Thumbnail";

/** A token that identifies a specific instance of an iModel to be operated on */
export class IModelToken {
  /** Constructor */
  public constructor(
    /** Key used for identifying the iModel on the backend */
    public readonly pathKey?: string,
    /** True for standalone iModels */
    public readonly isStandalone?: boolean,
    /** Context (Project or Asset) in which the iModel exists. May be undefined *only* if it's a standalone iModel */
    public readonly contextId?: string,
    /** Guid of the iModel. May not be defined *only* if it's a standalone iModel */
    public readonly iModelId?: string,
    /** Id of the last ChangeSet that was applied to the iModel */
    public changeSetId?: string,
    /** Mode used to open the iModel */
    public readonly openMode?: OpenMode,
    /** Id of the user that's currently editing or viewing the iModel. May not be defined *only* if it's a standalone iModel */
    public readonly userId?: string,
  ) { }
}

/** properties that position an iModel on the earth via ECEF (Earth Centered Earth Fixed) coordinates */
export interface EcefLocationProps {
  origin: XYZProps;
  orientation: YawPitchRollProps;
}

/** the location/orientation of an iModel on the earth via ECEF (Earth Centered Earth Fixed) coordinates */
export class EcefLocation implements EcefLocationProps {
  public origin: Point3d;
  public orientation: YawPitchRollAngles;
  constructor(props: EcefLocationProps) {
    this.origin = Point3d.fromJSON(props.origin);
    this.orientation = YawPitchRollAngles.fromJSON(props.orientation);
  }
}

/** the Root Subject is the base for the "table of contents" of an iModel. Every iModel has one and only one. */
export interface RootSubjectProps {
  /** the name of the root subject for an iModel. */
  name: string;
  /** optional description of the root subject. */
  description?: string;
}

/** The properties that are global to an iModel. */
export interface IModelProps {
  /** the name and description of the root subject of this iModel */
  rootSubject: RootSubjectProps;
  /** The volume of the entire project */
  projectExtents?: Range3dProps;
  /** An offset to be applied to all spatial coordinates. This is normally used to transform spatial coordinates into the Cartesian coordinate system of a Geographic Coordinate System. */
  globalOrigin?: XYZProps;
  /** The location of the project in Earth Centered Earth Fixed coordinates. iModel units are always meters */
  ecefLocation?: EcefLocationProps;
}

/** The properties that can be supplied when creating a new iModel. */
export interface CreateIModelProps extends IModelProps {
  /** the GUID of new iModel. If not present, a GUID will be generated. */
  guid?: GuidProps;
  /** client name for new iModel */
  client?: string;
  /** thumbnail for new iModel */
  thumbnail?: ThumbnailProps;
}

export interface FilePropertyProps {
  namespace: string;
  name: string;
  id?: number;
  subId?: number;
}

/** Represents an iModel. */
export abstract class IModel implements IModelProps {
  /** Name of the iModel */
  public name!: string;
  /** The name and description of the root subject of this iModel */
  public rootSubject!: RootSubjectProps;
  /** The volume inside which the entire project is contained. */
  public projectExtents!: AxisAlignedBox3d;
  /** An offset to be applied to all spatial coordinates. */
  public globalOrigin!: Point3d;
  /** The location of the iModel in Earth Centered Earth Fixed coordinates. */
  public ecefLocation?: EcefLocation;

  public toJSON(): any {
    const out: any = {};
    out.name = this.name;
    out.rootSubject = this.rootSubject;
    out.projectExtents = this.projectExtents;
    out.globalOrigin = this.globalOrigin;
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
    this.globalOrigin = Point3d.fromJSON(props.globalOrigin);
    if (props.ecefLocation)
      this.ecefLocation = new EcefLocation(props.ecefLocation);
  }

  /** Check if this iModel has been opened read-only or not. */
  public isReadonly() { return this.token.openMode === OpenMode.Readonly; }

  /** get the default subCategoryId for the supplied categoryId */
  public static getDefaultSubCategoryId(categoryId: Id64): Id64 { return categoryId.isValid() ? new Id64([categoryId.getLow() + 1, categoryId.getHigh()]) : new Id64(); }

  /** Get the Id of the special dictionary model */
  public static getDictionaryId(): Id64 { return new Id64("0x10"); }
}
