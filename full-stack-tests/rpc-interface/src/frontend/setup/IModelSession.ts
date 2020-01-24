/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Config } from "@bentley/imodeljs-clients";
import { IModelConnection } from "@bentley/imodeljs-frontend";

// tslint:disable:ter-indent

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
      const env = Config.App.get("imjs_buddi_resolve_url_using_region");
      // tslint:disable-next-line:no-console
      console.log("Environment: " + env);
      this._iModel = await IModelConnection.open(this.contextId, this.iModelId);
      expect(this._iModel).to.exist;
    } catch (e) {
      throw new Error(`Failed to open test iModel. Error: ${e.message}`);
    }

    return this._iModel;
  }
}
