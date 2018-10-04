/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Logger, OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import SampleRpcInterface from "../../common/SampleRpcInterface";

export class MyAppFrontend {
  public static iModel: IModelConnection | undefined;

  public static async getSampleImodels(): Promise<string[]> {
    return await SampleRpcInterface.getClient().getSampleImodels();
  }

  public static async openIModel(path: string): Promise<IModelConnection> {
    this.iModel = await IModelConnection.openStandalone(path, OpenMode.Readonly);
    Logger.logInfo("presentation", "Opened: " + this.iModel.name);
    return this.iModel;
  }
}
