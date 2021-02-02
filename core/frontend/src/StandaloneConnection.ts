/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { GuidString, OpenMode } from "@bentley/bentleyjs-core";
import { StandaloneOpenOptions } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { IpcApp } from "./IpcApp";

/** A connection to a [StandaloneDb]($backend) from an [IpcHost]($backend)
 * @beta
 */
export class StandaloneConnection extends IModelConnection {
  public isStandaloneConnection(): this is StandaloneConnection { return true; }

  /** The Guid that identifies this iModel. */
  public get iModelId(): GuidString { return super.iModelId!; } // GuidString | undefined for the superclass, but required for StandaloneConnection

  /** Returns `true` if [[close]] has already been called. */
  public get isClosed(): boolean { return this._isClosed ? true : false; }
  private _isClosed?: boolean;

  /** Open an IModelConnection to a standalone iModel.
   * @note This method requires an [[IpcApp]].
   */
  public static async openFile(filePath: string, openMode: OpenMode = OpenMode.ReadWrite, opts?: StandaloneOpenOptions): Promise<StandaloneConnection> {
    const openResponse = await IpcApp.callIpcHost("openStandalone", filePath, openMode, opts);
    const connection = new StandaloneConnection(openResponse);
    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  /** Close this StandaloneConnection.
   * @see [[openFile]]
   */
  public async close(): Promise<void> {
    if (this.isClosed)
      return;

    this.beforeClose();
    this._isClosed = true;
    await IpcApp.callIpcHost("close", this.key);
  }
}
