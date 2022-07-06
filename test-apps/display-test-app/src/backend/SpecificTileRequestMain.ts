/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IpcApp, NullRenderSystem } from "@itwin/core-frontend";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { SnapshotDb } from "@itwin/core-backend";
import { Logger, ProcessDetector } from "@itwin/core-bentley";
import * as path from "path";
import { EventEmitter } from "events";
import { getRpcInterfaces, initializeDtaBackend, loadBackendConfig } from "./Backend";
import { IModelTileRpcInterface, IpcListener, IpcSocketBackend, IpcSocketFrontend, RemoveFunction, RpcManager, TestRpcManager } from "@itwin/core-common";
import * as jsdom from "jsdom";

const dom = new jsdom.JSDOM();
Object.assign(globalThis, dom);
(globalThis as any).window = dom.window;

const dtaElectronMain = async () => {
  // Need to load the config first to get the electron options
  loadBackendConfig();

  const opts = {
    webResourcesPath: path.join(__dirname, "..", "..", "build"),
    iconName: "display-test-app.ico",
    rpcInterfaces: getRpcInterfaces(),
    developmentServer: process.env.NODE_ENV === "development",
  };

  /*
  const ipcFrontEvents = new EventEmitter();
  const ipcBackEvents = new EventEmitter();
  const specialFinishedInvoking = "@@~FinishedInvoking__!";

  const _ipcBack = new (class implements IpcSocketBackend {
    public handle(channel: string, handler: (...args: any[]) => Promise<any>) {
      const handlerWithFinish = async (...args: any[]) => {
        const result = await handler(...args);
        ipcBackEvents.emit(specialFinishedInvoking, result);
      };
      ipcBackEvents.addListener(channel, handlerWithFinish);
      return () => ipcBackEvents.removeListener(channel, handlerWithFinish);
    }
    public send(channel: string, ...data: any[]) {
      ipcFrontEvents.emit(channel, ...data);
    }
    public addListener(channel: string, listener: IpcListener) {
      ipcBackEvents.addListener(channel, listener);
      return () => ipcBackEvents.removeListener(channel, listener);
    }
    public removeListener(channel: string, listener: IpcListener) {
      return ipcBackEvents.removeListener(channel, listener);
    }
  })();
  */

  await initializeDtaBackend(opts);

  /*
  const _ipcFront = new (class implements IpcSocketFrontend {
    public async invoke(channel: string, ...args: any[]) {
      return new Promise((resolve, _reject) => {
        ipcBackEvents.once(specialFinishedInvoking, (result) => {
          resolve(result);
        });
        ipcBackEvents.emit(channel, ...args);
      });
    }
    public send(channel: string, ...data: any[]) {
      ipcBackEvents.emit(channel, ...data);
    }
    public addListener(channel: string, listener: IpcListener) {
      ipcFrontEvents.addListener(channel, listener);
      return () => ipcFrontEvents.removeListener(channel, listener);
    }
    public removeListener(channel: string, listener: IpcListener) {
      return ipcFrontEvents.removeListener(channel, listener);
    }
  })();
  await IpcApp.startup(_ipcFront, { iModelApp: { renderSys: new NullRenderSystem() } });
  */
  // HACK
  Object.defineProperty(ProcessDetector, "isElectronAppFrontend", {
    get() { return true; },
  });
  await ElectronApp.startup({ iModelApp: { renderSys: new NullRenderSystem() } });
  TestRpcManager.initialize(opts.rpcInterfaces);

  // must be opened
  const db = SnapshotDb.openFile("/tmp/Juergen.Hofer.Bad.Normals.bim");
  const tileReqLog = require("../../tile_rpc_log.json");
  let i = 0;
  const tileClient = RpcManager.getClientForInterface(IModelTileRpcInterface);
  for (const tileReq of tileReqLog) {
    Logger.logTrace("STRM", `(index: ${i})`);
    switch (tileReq.rpcMethod) {
      case "generateTileContent":
        await tileClient.generateTileContent(db.getRpcProps(), tileReq.treeId, tileReq.contentId, undefined);
        break;
      case "requestTileTreeProps":
        await tileClient.requestTileTreeProps(db.getRpcProps(), tileReq.treeId);
        break;
    }
    i++;
  }
  const electron = require("electron");
  if (typeof electron === "object" && "app" in electron)
    electron.app.quit();
};

// execute this immediately when we load
// eslint-disable-next-line no-console
dtaElectronMain().catch(console.error);
