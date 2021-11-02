/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
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
    const enableIModelBank: boolean = process.env.IMJS_TEST_IMODEL_BANK !== undefined && !!JSON.parse(process.env.IMJS_TEST_IMODEL_BANK);
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
