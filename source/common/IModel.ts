/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AxisAlignedBox3d } from "../common/geometry/Primitives";

/** A token that identifies an instance of an iModel. */
export class IModelToken {
  public pathname: string; // WIP: move to IModelDb
  public openMode?: OpenMode; // WIP: should move to IModel
  public iModelId?: string; // WIP: should remain in IModelToken and not be optional
  public briefcaseId?: number; // WIP: move to IModelDb?
  public userId?: string; // WIP: does not belong in IModelToken, store AccessToken in IModelConnection?
  public changeSetId?: string; // WIP: should remain in IModelToken and not be optional
  public changeSetIndex?: number; // WIP: should not remain in IModelToken
  public isOpen?: boolean; // WIP: does not belong in IModelToken
  public contextId?: string; // Context ID - projectId or assetId

  public static fromFile(pathname: string, openMode: OpenMode, isOpen: boolean): IModelToken {
    const token = new IModelToken();
    token.pathname = pathname;
    token.openMode = openMode;
    token.isOpen = isOpen;
    return token;
  }

  public static fromBriefcase(iModelId: string, briefcaseId: number, pathname: string, userId: string): IModelToken {
    const token = new IModelToken();
    token.iModelId = iModelId;
    token.briefcaseId = briefcaseId;
    token.pathname = pathname;
    token.userId = userId;
    return token;
  }
}

/** An abstract class representing an instance of an iModel. */
export class IModel {
  public readonly name: string;
  public readonly description: string;
  public readonly extents: AxisAlignedBox3d = new AxisAlignedBox3d();

  /** @hidden */
  protected _iModelToken: IModelToken;
  /** The token that can be used to find this iModel instance. */
  public get iModelToken(): IModelToken { return this._iModelToken; }
  /** @hidden */
  protected constructor(iModelToken: IModelToken, name: string, description: string, extents: any) {
    this._iModelToken = iModelToken;
    this.name = name;
    this.description = description;
    this.extents = extents;
  }

  /** @hidden */
  protected toJSON(): any { return undefined; } // we don't have any members that are relevant to JSON

  public isReadonly() { return this._iModelToken.openMode === OpenMode.Readonly; }
}
