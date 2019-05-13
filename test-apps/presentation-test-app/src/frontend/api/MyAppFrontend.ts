/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Logger, Guid } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import SampleRpcInterface from "../../common/SampleRpcInterface";

export class MyAppFrontend {
  public static iModel: IModelConnection | undefined;

  public static async getSampleImodels(): Promise<string[]> {
    return SampleRpcInterface.getClient().getSampleImodels();
  }

  public static async getAvailableRulesets(): Promise<string[]> {
    return SampleRpcInterface.getClient().getAvailableRulesets();
  }

  public static async openIModel(path: string): Promise<IModelConnection> {
    this.iModel = await IModelConnection.openSnapshot(path);
    Logger.logInfo("presentation", "Opened: " + this.iModel.name);
    return this.iModel;
  }

  public static getClientId(): string {
    const key = "presentation-test-app/client-id";
    let value = window.localStorage.getItem(key);
    if (!value) {
      value = Guid.createValue();
      window.localStorage.setItem(key, value);
    }
    return value;
  }
}
