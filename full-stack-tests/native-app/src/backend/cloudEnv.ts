/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelCloudEnvironment } from "@bentley/imodeljs-clients/lib/IModelCloudEnvironment";
import { Config } from "@bentley/imodeljs-clients";
import { IModelHubBackendCloudEnv } from "./IModelHubBackendCloudEnv";
import { getIModelBankCloudEnv } from "./IModelBankBackendCloudEnv";

export class CloudEnv {
  public static readonly enableIModelBank: boolean = Config.App.has("imjs_test_imodel_bank") && !!JSON.parse(Config.App.get("imjs_test_imodel_bank"));
  private static _cloudEnv: IModelCloudEnvironment | undefined;

  public static get cloudEnv(): IModelCloudEnvironment {
    if (this._cloudEnv === undefined)
      throw new Error("call initialize first");
    return this._cloudEnv;
  }

  public static async initialize(): Promise<void> {

    if (!this.enableIModelBank) {
      this._cloudEnv = new IModelHubBackendCloudEnv();
    } else {
      this._cloudEnv = getIModelBankCloudEnv();
    }
    if (this._cloudEnv === undefined)
      throw new Error("could not create cloudEnv");

    await this._cloudEnv.startup();
  }
}
