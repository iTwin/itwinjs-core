/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { Guid, GuidString, IModelStatus, OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnectionProps, IModelError, OpenBriefcaseProps, StandaloneOpenOptions } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { IpcApp, NotificationHandler } from "./IpcApp";

/**
 * Base class for notification handlers for events from the backend that are specific to a Briefcase.
 * @beta
 */
export abstract class BriefcaseNotificationHandler extends NotificationHandler {
  constructor(private _key: string) { super(); }
  public abstract get briefcaseChannelName(): string;
  public get channelName() { return `${this.briefcaseChannelName}:${this._key}`; }
}

/** A connection to an editable briefcase on the backend. This class uses [Ipc]($docs/learning/IpcInterface.md) to communicate
 * to the backend and may only be used by [[IpcApp]]s.
 * @public
 */
export class BriefcaseConnection extends IModelConnection {
  public isBriefcaseConnection(): this is BriefcaseConnection { return true; }
  /** The Guid that identifies the *context* that owns this iModel. */
  public get contextId(): GuidString { return super.contextId!; } // GuidString | undefined for IModelConnection, but required for BriefcaseConnection
  /** The Guid that identifies this iModel. */
  public get iModelId(): GuidString { return super.iModelId!; } // GuidString | undefined for IModelConnection, but required for BriefcaseConnection

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

  /** Returns `true` if [[close]] has already been called. */
  public get isClosed(): boolean { return this._isClosed === true; }
  protected _isClosed?: boolean;

  /**
   * Close this BriefcaseConnection.
   * @note make sure to call SaveChanges before calling this method. Unsaved local changes are abandoned.
   */
  public async close(): Promise<void> {
    if (this.isClosed)
      return;
    this.beforeClose();
    this._isClosed = true;
    await IpcApp.callIpcHost("closeIModel", this._fileKey);
  }

  private requireContext() {
    if (this.contextId === Guid.empty)
      throw new IModelError(IModelStatus.WrongIModel, "iModel has no timeline");
  }

  /** @beta */
  public async hasPendingTxns(): Promise<boolean> { // eslint-disable-line @bentley/prefer-get
    return IpcApp.callIpcHost("hasPendingTxns", this.key);
  }

  /** @beta */
  public async saveChanges(description?: string): Promise<void> {
    await IpcApp.callIpcHost("saveChanges", this.key, description);
  }

  /** @beta */
  public async pullAndMergeChanges(): Promise<IModelConnectionProps> {
    this.requireContext();
    return IpcApp.callIpcHost("pullAndMergeChanges", this.key);
  }

  /** @beta */
  public async pushChanges(description: string): Promise<IModelConnectionProps> {
    this.requireContext();
    return IpcApp.callIpcHost("pushChanges", this.key, description);
  }
}
