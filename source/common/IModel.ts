/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AxisAlignedBox3d } from "../common/geometry/Primitives";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";

/** A token that identifies a specific instance of an iModel to be operated on */
export class IModelToken {
  /** Guid of the iModel */
  public iModelId: string;
  /** Id of the last ChangeSet that was applied to the iModel */
  public changeSetId: string;
  /** Mode used to open the iModel */
  public openMode: OpenMode;
  /** Id of the user that's currently editing or viewing the iModel. May not be defined *only* if it's a standalone iModel */
  public userId?: string;
  /** Context (Project or Asset) in which the iModel exists. May not be defined *only* if it's a standalone iModel */
  public contextId?: string;

  /** Constructor */
  public static create(iModelId: string, changeSetId: string, openMode: OpenMode, userId?: string, contextId?: string): IModelToken {
    const token = new IModelToken();
    Object.assign(token, { iModelId, changeSetId, openMode, userId, contextId });
    return token;
  }
}

/** An abstract class representing an instance of an iModel. */
export abstract class IModel {

  /** Name of the iModel */
  public readonly name: string;

  /** Description of the iModel */
  public readonly description: string;

  /** Extents of the iModel */
  public abstract getExtents(): AxisAlignedBox3d;

  /** @hidden */
  protected _iModelToken: IModelToken;

  /** The token that can be used to find this iModel instance. */
  public get iModelToken(): IModelToken { return this._iModelToken; }

  /** @hidden */
  protected constructor(iModelToken: IModelToken, name: string, description: string) {
    this._iModelToken = iModelToken;
    this.name = name;
    this.description = description;
  }

  /** @hidden */
  protected toJSON(): any { return undefined; } // we don't have any members that are relevant to JSON

  public isReadonly() { return this._iModelToken.openMode === OpenMode.Readonly; }
}
