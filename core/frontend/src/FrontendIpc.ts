/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { IpcSocketFrontend } from "@bentley/imodeljs-common";

export class FrontendIpc {
  private static _ipc: IpcSocketFrontend | undefined;
  public static get ipc(): IpcSocketFrontend { return this._ipc!; }
  public static initialize(ipc: IpcSocketFrontend) { this._ipc = ipc; }
  public static get isValid(): boolean { return undefined !== this._ipc; }
}
