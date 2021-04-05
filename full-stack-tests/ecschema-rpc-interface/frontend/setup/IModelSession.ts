/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelConnection, RemoteBriefcaseConnection } from "@bentley/imodeljs-frontend";

export class IModelSession {

  public contextId: string;
  public iModelId: string;

  private _iModel?: IModelConnection;

  public constructor(iModelId: string, contextId: string) {
    this.contextId = contextId;
    this.iModelId = iModelId;
  }

  public async getConnection(): Promise<IModelConnection> {
    return undefined === this._iModel ? this.open() : this._iModel;
  }

  public async open(): Promise<IModelConnection> {
    try {
      this._iModel = await RemoteBriefcaseConnection.open(this.contextId, this.iModelId);
      expect(this._iModel).to.exist;
    } catch (e) {
      throw new Error(`Failed to open test iModel. Error: ${e.message}`);
    }

    return this._iModel;
  }
}
