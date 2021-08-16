/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CheckpointConnection } from "@bentley/imodeljs-frontend";

export class IModelSession {

  public contextId: string;
  public iModelId: string;

  private _iModel?: CheckpointConnection;

  public constructor(iModelId: string, contextId: string) {
    this.contextId = contextId;
    this.iModelId = iModelId;
  }

  public async getConnection(): Promise<CheckpointConnection> {
    return undefined === this._iModel ? this.open() : this._iModel;
  }

  public async open(): Promise<CheckpointConnection> {
    try {
      const env = process.env.IMJS_BUDDI_RESOLVE_URL_USING_REGION;
      // eslint-disable-next-line no-console
      console.log(`Environment: ${env}`);
      this._iModel = await CheckpointConnection.openRemote(this.contextId, this.iModelId);
      expect(this._iModel).to.exist;
    } catch (e) {
      throw new Error(`Failed to open test iModel. Error: ${e.message}`);
    }

    return this._iModel;
  }
}
