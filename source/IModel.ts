/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { MetaDataRegistry } from "./ClassRegistry";

/** A token that identifies an instance of an iModel. */
export class IModelToken {
  public pathname: string;
  public openMode?: OpenMode;

  public imodelId?: string;
  public briefcaseId?: number;
  public userId?: string;

  public changeSetId?: string;
  public changeSetIndex?: number;

  public isOpen?: boolean;

  public static fromFile(pathname: string, openMode: OpenMode, isOpen: boolean): IModelToken {
    const token = new IModelToken();
    token.pathname = pathname;
    token.openMode = openMode;
    token.isOpen = isOpen;
    return token;
  }

  public static fromBriefcase(imodelId: string, briefcaseId: number, pathname: string, userId: string): IModelToken {
    const token = new IModelToken();
    token.imodelId = imodelId;
    token.briefcaseId = briefcaseId;
    token.pathname = pathname;
    token.userId = userId;
    return token;
  }
}

/** An abstract class representing an instance of an iModel. */
export class IModel {
  /** @hidden */
  protected _iModelToken: IModelToken;
  /** The token that can be used to find this iModel instance. */
  public get iModelToken(): IModelToken { return this._iModelToken; }

  private _classMetaDataRegistry: MetaDataRegistry;
  /** Get the ClassMetaDataRegistry for this iModel */
  public get classMetaDataRegistry(): MetaDataRegistry {
    if (!this._classMetaDataRegistry)
      this._classMetaDataRegistry = new MetaDataRegistry();
    return this._classMetaDataRegistry;
  }

  /** @hidden */
  protected constructor(iModelToken: IModelToken) {
    this._iModelToken = iModelToken;
  }

  /** @hidden */
  protected toJSON(): any { return undefined; } // we don't have any members that are relevant to JSON
}
