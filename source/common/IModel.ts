/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode, Id64 } from "@bentley/bentleyjs-core";
import { Point3d, XYZProps, TransformProps, Range3dProps, Transform } from "@bentley/geometry-core";
import { AxisAlignedBox3d } from "./geometry/Primitives";

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

/** The properties that define an iModel. */
export interface IModelProps {
  rootSubject?: { name: string, description?: string };
  /** the volume of the entire project */
  projectExtents?: Range3dProps;
  globalOrigin?: XYZProps;
  /** The transform from project coordinates to Earth Centered Earth Fixed coordinates. */
  ecefTrans?: TransformProps;
}

/** An instance of an iModel. */
export abstract class IModel implements IModelProps {
  /** Name of the iModel */
  public name: string;
  /** the name and description of the root subject of this iModel */
  public rootSubject?: { name: string, description?: string };
  /** The volume inside which the entire project is contained. */
  public projectExtents: AxisAlignedBox3d;
  public globalOrigin: Point3d;
  /** The transform from project coordinates to Earth Centered Earth Fixed coordinates. */
  public ecefTrans?: Transform;

  public toJSON(): any {
    const out: any = {};
    out.name = this.name;
    out.rootSubject = this.rootSubject;
    out.projectExtents = this.projectExtents;
    out.globalOrigin = this.globalOrigin;
    out.ecefTrans = this.ecefTrans;
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
    if (props.ecefTrans)
      this.ecefTrans = Transform.fromJSON(props.ecefTrans);
  }

  public isReadonly() { return this.token.openMode === OpenMode.Readonly; }
  public static getDefaultSubCategoryId(id: Id64): Id64 { return id.isValid() ? new Id64([id.getLow() + 1, id.getHigh()]) : new Id64(); }

  /** Get the Id of the special dictionary model */
  public static getDictionaryId(): Id64 { return new Id64("0x10"); }
}
