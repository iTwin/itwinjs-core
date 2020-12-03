/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Config } from "@bentley/bentleyjs-core";
import { IModelCloudEnvironment } from "@bentley/imodelhub-client";
import { getIModelBankCloudEnv } from "./IModelBankBackendCloudEnv";
import { IModelHubBackendCloudEnv } from "./IModelHubBackendCloudEnv";

export class CloudEnv {
  private static _cloudEnv: IModelCloudEnvironment | undefined;

  public static get cloudEnv(): IModelCloudEnvironment {
    if (this._cloudEnv === undefined)
      throw new Error("call initialize first");
    return this._cloudEnv;
  }

  public static async initialize(): Promise<void> {
    const enableIModelBank: boolean = Config.App.has("imjs_test_imodel_bank") && !!JSON.parse(Config.App.get("imjs_test_imodel_bank"));
    if (!enableIModelBank) {
      this._cloudEnv = new IModelHubBackendCloudEnv();
    } else {
      this._cloudEnv = getIModelBankCloudEnv();
    }
    if (this._cloudEnv === undefined)
      throw new Error("could not create cloudEnv");

    await this._cloudEnv.startup();
  }
}
