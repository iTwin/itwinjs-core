/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Guid, Logger } from "@bentley/bentleyjs-core";
import { ViewQueryParams } from "@bentley/imodeljs-common";
import { IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";
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
    this.iModel = await SnapshotConnection.openFile(path);
    Logger.logInfo("presentation", `Opened: ${this.iModel.name}`);
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

  public static async getViewDefinitions(imodel: IModelConnection): Promise<{ id: string, class: string, label: string }[]> {
    const viewQueryParams: ViewQueryParams = { wantPrivate: false };
    const viewSpecs = await imodel.views.queryProps(viewQueryParams);
    return viewSpecs
      .filter((spec) => !spec.isPrivate)
      .map((spec) => ({
        id: spec.id!,
        class: spec.classFullName,
        label: spec.userLabel ?? spec.code.value!,
      }));
  }
}
