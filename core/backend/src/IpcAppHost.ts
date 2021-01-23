/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeAppBackend
 */

import { ClientRequestContext, Logger, LogLevel } from "@bentley/bentleyjs-core";
import {
  BackendIpc,
  BriefcasePushAndPullNotifications,
  GeometryChangeNotifications,
  IModelConnectionProps, IModelError, IModelRpcProps, IpcAppChannel, IpcAppFunctions, IpcHandler, OpenBriefcaseProps, TileTreeContentIds,
} from "@bentley/imodeljs-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { BriefcaseDb, IModelDb, StandaloneDb } from "./IModelDb";
import { IModelHost, IModelHostConfiguration } from "./IModelHost";
import { cancelTileContentRequests } from "./rpc-impl/IModelTileRpcImpl";

/**
 * Implementation for backend of IpcAppInvoke
 */
class IpcAppImpl extends IpcHandler implements IpcAppFunctions {
  public get channelName() { return IpcAppChannel.Functions; }
  public async log(_timestamp: number, level: LogLevel, category: string, message: string, metaData?: any): Promise<void> {
    Logger.logRaw(level, category, message, () => metaData);
  }
  public async cancelTileContentRequests(tokenProps: IModelRpcProps, contentIds: TileTreeContentIds[]): Promise<void> {
    return cancelTileContentRequests(tokenProps, contentIds);
  }

  public async cancelElementGraphicsRequests(rpcProps: IModelRpcProps, requestIds: string[]): Promise<void> {
    const iModel = IModelDb.findByKey(rpcProps.key);
    return iModel.nativeDb.cancelElementGraphicsRequests(requestIds);
  }
  public async open(args: OpenBriefcaseProps): Promise<IModelConnectionProps> {
    const requestContext = ClientRequestContext.current;
    const db = await BriefcaseDb.open(requestContext, args);
    requestContext.enter();
    return db.toJSON();
  }

  public async closeBriefcase(key: string): Promise<void> {
    BriefcaseDb.findByKey(key).close();
  }
  public async toggleInteractiveEditingSession(tokenProps: IModelRpcProps, startSession: boolean): Promise<boolean> {
    const imodel = IModelDb.findByKey(tokenProps.key);
    const val: IModelJsNative.ErrorStatusOrResult<any, boolean> = imodel.nativeDb.setGeometricModelTrackingEnabled(startSession);
    if (val.error)
      throw new IModelError(val.error.status, "Failed to toggle interactive editing session");

    return val.result!;
  }

  public async isInteractiveEditingSupported(tokenProps: IModelRpcProps): Promise<boolean> {
    const imodel = IModelDb.findByKey(tokenProps.key);
    return imodel.nativeDb.isGeometricModelTrackingSupported();
  }
}

/**
 * Used by applications that have a dedicated backend
 * @internal
*/
export class IpcAppHost extends IModelHost {
  public static notifyGeometryChanges<T extends keyof GeometryChangeNotifications>(briefcase: BriefcaseDb | StandaloneDb, methodName: T, ...args: Parameters<GeometryChangeNotifications[T]>) {
    return BackendIpc.send(`${IpcAppChannel.GeometryChanges}:${briefcase.key}`, methodName, ...args);
  }

  public static notifyPushAndPull<T extends keyof BriefcasePushAndPullNotifications>(briefcase: BriefcaseDb | StandaloneDb, methodName: T, ...args: Parameters<BriefcasePushAndPullNotifications[T]>) {
    return BackendIpc.send(`${IpcAppChannel.GeometryChanges}:${briefcase.key}`, methodName, ...args);
  }

  public static async startup(configuration: IModelHostConfiguration = new IModelHostConfiguration()): Promise<void> {
    await super.startup(configuration);
    IpcAppImpl.register();
  }
}
