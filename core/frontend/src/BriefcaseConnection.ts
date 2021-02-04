/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { GuidString, OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnectionProps, OpenBriefcaseProps, StandaloneOpenOptions } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { IpcApp, NotificationHandler } from "./IpcApp";

/** @beta */
export abstract class BriefcaseNotificationHandler extends NotificationHandler {
  constructor(private _key: string) { super(); }
  public abstract get briefcaseChannelName(): string;
  public get channelName() { return `${this.briefcaseChannelName}:${this._key}`; }
}

/** A connection to a briefcase on the backend.
 * @public
 */
export class BriefcaseConnection extends IModelConnection {
  /** The Guid that identifies the *context* that owns this iModel. */
  public get contextId(): GuidString { return super.contextId!; } // GuidString | undefined for the superclass, but required for BriefcaseConnection
  /** The Guid that identifies this iModel. */
  public get iModelId(): GuidString { return super.iModelId!; } // GuidString | undefined for the superclass, but required for BriefcaseConnection

  /** Returns `true` if [[close]] has already been called. */
  public get isClosed(): boolean { return this._isClosed ? true : false; }
  protected _isClosed?: boolean;

  public isBriefcaseConnection(): this is BriefcaseConnection { return true; }

  /** Open a BriefcaseConnection to a [BriefcaseDb]($backend). */
  public static async openFile(briefcaseProps: OpenBriefcaseProps): Promise<BriefcaseConnection> {
    const iModelProps = await IpcApp.callIpcHost("openBriefcase", briefcaseProps);
    const connection = new this({ ...briefcaseProps, ...iModelProps });
    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  /** Open a BriefcaseConnection to a StandaloneDb.
   * @note StandaloneDbs, by definition, may not push or pull changes. Attempting to do so will throw exceptions.
   * @internal
   */
  public static async openStandalone(filePath: string, openMode: OpenMode = OpenMode.ReadWrite, opts?: StandaloneOpenOptions): Promise<BriefcaseConnection> {
    const openResponse = await IpcApp.callIpcHost("openStandalone", filePath, openMode, opts);
    const connection = new this(openResponse);
    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  /**
   * Close this LocalBriefcaseConnection.
   * @note make sure to call SaveChanges before calling this method. Unsaved local changes are abandoned.
   */
  public async close(): Promise<void> {
    if (this.isClosed)
      return;
    this.beforeClose();
    this._isClosed = true;
    await IpcApp.callIpcHost("close", this._fileKey);
  }

  /** @beta */
  public async hasPendingTxns(): Promise<boolean> { // eslint-disable-line @bentley/prefer-get
    return IpcApp.callIpcHost("hasPendingTxns", this.key);
  }

  /** @beta */
  public async pullAndMergeChanges(): Promise<IModelConnectionProps> {
    return IpcApp.callIpcHost("pullAndMergeChanges", this.key);
  }

  /** @beta */
  public async pushChanges(description: string): Promise<IModelConnectionProps> {
    return IpcApp.callIpcHost("pushChanges", this.key, description);
  }

  /** @beta */
  public async saveChanges(description?: string): Promise<void> {
    await IpcApp.callIpcHost("saveChanges", this.key, description);
  }
}

