/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { Guid, GuidString, IModelStatus, OpenMode } from "@bentley/bentleyjs-core";
import {
  IModelConnectionProps, IModelError, IModelVersionProps, OpenBriefcaseProps,
  StandaloneOpenOptions,
} from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { IpcApp } from "./IpcApp";
import { InteractiveEditingSession } from "./InteractiveEditingSession";
import { BriefcaseTxns } from "./BriefcaseTxns";

/** A connection to an editable briefcase on the backend. This class uses [Ipc]($docs/learning/IpcInterface.md) to communicate
 * to the backend and may only be used by [[IpcApp]]s.
 * @public
 */
export class BriefcaseConnection extends IModelConnection {
  private _editingSession?: InteractiveEditingSession;
  protected _isClosed?: boolean;
  /** Provides notifications about changes to the iModel.
   * @beta
   */
  public readonly txns: BriefcaseTxns;

  public isBriefcaseConnection(): this is BriefcaseConnection { return true; }

  /** The Guid that identifies the *context* that owns this iModel. */
  public get contextId(): GuidString { return super.contextId!; } // GuidString | undefined for IModelConnection, but required for BriefcaseConnection

  /** The Guid that identifies this iModel. */
  public get iModelId(): GuidString { return super.iModelId!; } // GuidString | undefined for IModelConnection, but required for BriefcaseConnection

  protected constructor(props: IModelConnectionProps) {
    super(props);
    this.txns = new BriefcaseTxns(this);
  }

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

  /**
   * Close this BriefcaseConnection.
   * @note make sure to call SaveChanges before calling this method. Unsaved local changes are abandoned.
   */
  public async close(): Promise<void> {
    if (this.isClosed)
      return;

    if (this._editingSession) {
      await this._editingSession.end();
      this._editingSession = undefined;
    }

    this.beforeClose();
    this.txns.dispose();

    this._isClosed = true;
    await IpcApp.callIpcHost("closeIModel", this._fileKey);
  }

  private requireTimeline() {
    if (this.contextId === Guid.empty)
      throw new IModelError(IModelStatus.WrongIModel, "iModel has no timeline");
  }

  /** @beta */
  public async hasPendingTxns(): Promise<boolean> { // eslint-disable-line @bentley/prefer-get
    return this.txns.hasPendingTxns();
  }

  /** @beta */
  public async saveChanges(description?: string): Promise<void> {
    await IpcApp.callIpcHost("saveChanges", this.key, description);
  }

  /** Pull (and potentially merge if there are local changes) up to a specified changeset from iModelHub into this briefcase
   * @param version The version to pull changes to. If` undefined`, pull all changes.
   * @beta */
  public async pullAndMergeChanges(version?: IModelVersionProps): Promise<void> {
    this.requireTimeline();
    return IpcApp.callIpcHost("pullAndMergeChanges", this.key, version);
  }

  /** Create a changeset from local Txns and push to iModelHub. On success, clear Txn table.
   * @param description The description for the changeset
   * @returns the changesetId of the pushed changes
   * @beta */
  public async pushChanges(description: string): Promise<string> {
    this.requireTimeline();
    return IpcApp.callIpcHost("pushChanges", this.key, description);
  }

  /** The current editing session, if one is in progress.
   * @see [[beginEditingSession]] to begin an editing session.
   * @beta
   */
  public get editingSession(): InteractiveEditingSession | undefined {
    return this._editingSession;
  }

  /** Return whether interactive editing is supported for this briefcase. It is not supported if the briefcase is read-only, or the briefcase contains a version of
   * the BisCore ECSchema older than v0.1.11.
   * @see [[beginEditingSession]] to begin an interactive editing session.
   * @beta
   */
  public async supportsInteractiveEditing(): Promise<boolean> {
    return IpcApp.callIpcHost("isInteractiveEditingSupported", this.key);
  }

  /** Begin a new editing session. This briefcase's [[editingSession]] property will be set to the new session until the session is ended.
   * @note The session should be ended before the briefcase is closed.
   * @throws Error if a session is already in progress or a session could not be started.
   * @see [[InteractiveEditingSession.end]] to end the session.
   * @see [[supportsInteractiveEditing]] to determine whether this method should be expected to succeed.
   * @see [[editingSession]] to obtain the current editing session, if one is in progress.
   * @beta
   */
  public async beginEditingSession(): Promise<InteractiveEditingSession> {
    if (this.editingSession)
      throw new Error("Cannot create an editing session for an iModel that already has one");

    this._editingSession = await InteractiveEditingSession.begin(this);
    this._editingSession.onEnded.addOnce(() => this._editingSession = undefined);
    return this._editingSession;
  }
}
