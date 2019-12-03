/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Logger } from "@bentley/bentleyjs-core";
import { IModelHost } from "@bentley/imodeljs-backend";
import * as electron from "electron";
import { ElectronManagerLoggerCategory } from "./ElectronManagerLoggerCategory";

const { ipcMain: ipc } = electron;
const KeyChainStore = IModelHost.platform && IModelHost.platform.KeyTar; // tslint:disable-line:variable-name

const loggerCategory: string = ElectronManagerLoggerCategory.Authentication;

/**
 * Utility to handle IPC calls for retrieving passwords in the system -
 * Credentials Vault on Windows or Key Chain Store on Mac.
 */
export class KeyChainStoreMain {
  public static initialize() {
    if (!KeyChainStore)
      Logger.logError(loggerCategory, "Could not obtain a handle to the native implementation of key chain store");

    ipc.handle("KeyChainStore-getPassword", async (_event, service, account) => {
      const password = await KeyChainStore.getPassword(service, account);
      return password;
    });

    ipc.handle("KeyChainStore-setPassword", async (_event, service, account, password) => {
      await KeyChainStore.setPassword(service, account, password);
    });

    ipc.handle("KeyChainStore-deletePassword", async (_event, service, account) => {
      await KeyChainStore.deletePassword(service, account);
    });
  }
}
