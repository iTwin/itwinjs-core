/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";

/** A token that represents a Briefcase */
export class BriefcaseToken {
  public pathname: string;
  public openMode?: OpenMode;

  public imodelId?: string;
  public briefcaseId?: number;
  public userId?: string;

  public changeSetId?: string;
  public changeSetIndex?: number;

  public isOpen?: boolean;

  public static fromFile(pathname: string, openMode: OpenMode, isOpen: boolean): BriefcaseToken {
    const token = new BriefcaseToken();
    token.pathname = pathname;
    token.openMode = openMode;
    token.isOpen = isOpen;
    return token;
  }

  public static fromBriefcase(imodelId: string, briefcaseId: number, pathname: string, userId: string): BriefcaseToken {
    const token = new BriefcaseToken();
    token.imodelId = imodelId;
    token.briefcaseId = briefcaseId;
    token.pathname = pathname;
    token.userId = userId;
    return token;
  }
}

/** An abstract class representing an instance of an iModel. */
export class IModel {
  protected _briefcaseKey: BriefcaseToken;
  protected toJSON(): any { return undefined; } // we don't have any members that are relevant to JSON
  public get briefcaseKey(): BriefcaseToken { return this._briefcaseKey; }

  /** @hidden */
  protected constructor(briefcaseKey: BriefcaseToken) {
    this._briefcaseKey = briefcaseKey;
   }

}
