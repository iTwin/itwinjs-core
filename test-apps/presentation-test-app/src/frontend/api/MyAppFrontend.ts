/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AsyncMethodsOf, Guid, Id64Arg, Logger, OpenMode, PromiseReturnType } from "@itwin/core-bentley";
import { ElementProps, IModelError, ViewQueryParams } from "@itwin/core-common";
import { BriefcaseConnection, IModelConnection, IpcApp, SnapshotConnection } from "@itwin/core-frontend";
import { UnitSystemKey } from "@itwin/core-quantity";
import { PRESENTATION_TEST_APP_IPC_CHANNEL_NAME, SampleIpcInterface } from "../../common/SampleIpcInterface";
import SampleRpcInterface from "../../common/SampleRpcInterface";

const LOCAL_STORAGE_KEY_AppSettings = "presentation-test-app/settings";

export interface MyAppSettings {
  imodelPath?: string;
  rulesetId?: string;
  unitSystem?: UnitSystemKey;
  persistSettings: boolean;
}

export class MyAppFrontend {
  public static async getSampleImodels(): Promise<string[]> {
    return SampleRpcInterface.getClient().getSampleImodels();
  }

  public static async getAvailableRulesets(): Promise<string[]> {
    return SampleRpcInterface.getClient().getAvailableRulesets();
  }

  public static async openIModel(path: string): Promise<IModelConnection | undefined> {
    let imodel: IModelConnection | undefined;
    if (IpcApp.isValid) {
      Logger.logInfo("presentation", `Trying to open standalone ${path}`);
      imodel = await tryOpenStandalone(path);
    }

    if (!imodel) {
      Logger.logInfo("presentation", `Opening snapshot: ${path}`);
      imodel = await SnapshotConnection.openFile(path);
      Logger.logInfo("presentation", `Opened snapshot: ${imodel.name}`);
    }

    return imodel;
  }

  public static get settings(): MyAppSettings {
    let strValue = window.localStorage.getItem(LOCAL_STORAGE_KEY_AppSettings);
    if (!strValue) {
      strValue = JSON.stringify({ persist: false });
      window.localStorage.setItem(LOCAL_STORAGE_KEY_AppSettings, strValue);
    }
    return JSON.parse(strValue);
  }

  public static set settings(value: MyAppSettings) {
    window.localStorage.setItem(LOCAL_STORAGE_KEY_AppSettings, JSON.stringify(value));
  }

  public static getClientId(): string {
    /*
    note: generally we'd want to reuse client id between windows and tabs for the same frontend user,
    but for specific case of presentation-test-app it's more suitable to always generate a new client
    id - that makes sure we get a new backend instance with each page refresh and helps for debugging.

    const key = "presentation-test-app/client-id";
    let value = window.localStorage.getItem(key);
    if (!value) {
      value = Guid.createValue();
      window.localStorage.setItem(key, value);
    }
    return value;
    */
    return Guid.createValue();
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
  } catch (err: any) {
    if (err instanceof IModelError) {
      Logger.logError("presentation", `Failed to open standalone: ${err.message}`, () => err.getMetaData());
    } else {
      Logger.logError("presentation", `Failed to open standalone.`);
    }
  }
  return iModel;
}
