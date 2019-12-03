/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Authentication */

import { isElectronRenderer, electronRenderer } from "@bentley/bentleyjs-core";

const ipc = isElectronRenderer ? electronRenderer.ipcRenderer : undefined;

/**
 * Utility to store passwords in the key chain - used from the electron renderer process.
 * @internal
 */
export class KeyChainStoreRenderer {
  /**
   * Get the stored password for the service and account.
   * @param service The string service name.
   * @param account The string account name.
   * @returns A promise for the password string.
   */
  public static async getPassword(service: string, account: string): Promise<string | null> {
    if (!ipc)
      throw new Error("This code should only be run in the electron renderer process");

    const password: string | null = await ipc.invoke("KeyChainStore-getPassword", service, account);
    return password;
  }

  /**
   * Add the password for the service and account to the keychain.
   * @param service The string service name.
   * @param account The string account name.
   * @param password The string password.
   * @returns A promise for the set password completion.
   */
  public static async setPassword(service: string, account: string, password: string): Promise<void> {
    if (!ipc)
      throw new Error("This code should only be run in the electron renderer process");

    return ipc.invoke("KeyChainStore-setPassword", service, account, password);
  }

  /**
   * Delete the stored password for the service and account.
   * @param service The string service name.
   * @param account The string account name.
   * @returns A promise for the deletion status. True on success.
   */
  public static async deletePassword(service: string, account: string): Promise<boolean> {
    if (!ipc)
      throw new Error("This code should only be run in the electron renderer process");

    const status: boolean = await ipc.invoke("KeyChainStore-deletePassword", service, account);
    return status;
  }
}
