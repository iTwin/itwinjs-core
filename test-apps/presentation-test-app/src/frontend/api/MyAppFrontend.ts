/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Guid, Id64Arg, Logger, OpenMode } from "@bentley/bentleyjs-core";
import { ElementProps, IModelError, ViewQueryParams } from "@bentley/imodeljs-common";
import { AsyncMethodsOf, BriefcaseConnection, IModelConnection, IpcApp, PromiseReturnType, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { PRESENTATION_TEST_APP_IPC_CHANNEL_NAME, SampleIpcInterface } from "../../common/SampleIpcInterface";
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
    if (IpcApp.isValid) {
      Logger.logInfo("presentation", `Trying to open standalone ${path}`);
      this.iModel = await tryOpenStandalone(path);
    }

    if (!this.iModel) {
      Logger.logInfo("presentation", `Opening snapshot: ${path}`);
      this.iModel = await SnapshotConnection.openFile(path);
      Logger.logInfo("presentation", `Opened snapshot: ${this.iModel.name}`);
    }

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

  public static async getViewDefinitions(imodel: IModelConnection) {
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

  public static async updateElement(imodel: IModelConnection, newProps: ElementProps) {
    if (!IpcApp.isValid)
      throw new Error(`Updating element only supported in 'IpcApp'`);
    return this.callIpc("updateElement", imodel.key, newProps);
  }

  public static async deleteElements(imodel: IModelConnection, elementIds: Id64Arg) {
    if (!IpcApp.isValid)
      throw new Error(`Deleting elements only supported in 'IpcApp'`);
    return this.callIpc("deleteElements", imodel.key, elementIds);
  }

  private static async callIpc<T extends AsyncMethodsOf<SampleIpcInterface>>(methodName: T, ...args: Parameters<SampleIpcInterface[T]>): Promise<PromiseReturnType<SampleIpcInterface[T]>> {
    return IpcApp.callIpcChannel(PRESENTATION_TEST_APP_IPC_CHANNEL_NAME, methodName, ...args);
  }
}

async function tryOpenStandalone(path: string) {
  let iModel: IModelConnection | undefined;
  try {
    iModel = await BriefcaseConnection.openStandalone(path, OpenMode.ReadWrite);
    Logger.logInfo("presentation", `Opened standalone: ${iModel.name}`);
  } catch (err) {
    if (err instanceof IModelError) {
      Logger.logError("presentation", `Failed to open standalone: ${err.message}`, err.getMetaData);
    } else {
      Logger.logError("presentation", `Failed to open standalone.`);
    }
  }
  return iModel;
}
