/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { DbResult, Id64String, IModelStatus, RepositoryStatus } from "@itwin/core-bentley";
import { ChannelRootAspectProps, IModel, IModelError } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";

/** The key for a channel. Used for "allowed channels" in [[ChannelControl]]
 * @beta
 */
export type ChannelKey = string;

/**
 * Controls which channels of an iModel are permitted for write operations. An implementation of this interface is
 * available via [[IModelDb.channels]].
 * @see [Working With Channels]($docs/learning/backend/Channel.md) for details
 * @beta
 */
export interface ChannelControl {
  /** Determine whether this [[IModelDb]] has any channels in it. */
  get hasChannels(): boolean;
  /** Add a new channel to the list of allowed channels of the [[IModelDb]] for this session.
   * @param channelKey The key for the channel to become editable in this session.
   */
  addAllowedChannel(channelKey: ChannelKey): void;
  /** Remove a channel from the list of allowed channels of the [[IModelDb]] for this session.
   * @param channelKey The key of the channel that should no longer be editable in this session.
   */
  removeAllowedChannel(channelKey: ChannelKey): void;
  /** Get the channelKey of the channel for an element by ElementId.
   * @throws if the element does not exist
   */
  getChannelKey(elementId: Id64String): ChannelKey;
  /** Make an existing element a new Channel root.
   * @note if the element is already in a channel, this will throw an error.
   */
  makeChannelRoot(args: { elementId: Id64String, channelKey: ChannelKey }): void;

  /** @internal */
  verifyChannel(modelId: Id64String): void;
}

/** @beta */
export namespace ChannelControl {
  /** the name of the special "shared" channel holding information that is editable by any application. */
  export const sharedChannelName = "shared";
}

/** @internal */
export class ChannelAdmin implements ChannelControl {
  public static readonly sharedChannel = "shared";
  public static readonly channelClassName = "bis:ChannelRootAspect";
  public static readonly subjectClassName = "bis:Subject";
  private _allowedChannels = new Set<ChannelKey>();
  private _allowedModels = new Set<Id64String>();
  private _deniedModels = new Map<Id64String, ChannelKey>();
  private _hasChannels?: boolean;
  private _channelRootAspectClassExists?: boolean;
  private _hasLegacyChannels?: boolean;

  public constructor(private _iModel: IModelDb) {
  }
  public addAllowedChannel(channelKey: ChannelKey) {
    this._allowedChannels.add(channelKey);
    this._deniedModels.clear();
  }
  public removeAllowedChannel(channelKey: ChannelKey) {
    this._allowedChannels.delete(channelKey);
    this._allowedModels.clear();
  }
  private querySchemaVersion(schemaName: string): { generation: number, write: number, read: number } | undefined {
    return this._iModel.withPreparedStatement(
      "SELECT VersionMajor, VersionWrite, VersionMinor FROM meta.ECSchemaDef WHERE Name=?", (stmt) => {
        stmt.bindString(1, schemaName);
        return DbResult.BE_SQLITE_ROW === stmt.step() ? {
          generation: stmt.getValue(0).getInteger(),
          write: stmt.getValue(1).getInteger(),
          read: stmt.getValue(2).getInteger(),
        } : undefined;
      });
  }

  private get _bisCoreSupportsChannelRootAspect(): boolean {
    if (undefined === this._channelRootAspectClassExists) {
      const bisCoreVersion = this.querySchemaVersion("BisCore");
      if (bisCoreVersion === undefined)
        throw new Error("could not determine BisCore schema version");
      this._channelRootAspectClassExists = (bisCoreVersion.generation === 1 && bisCoreVersion.read >= 10);
    }
    return this._channelRootAspectClassExists;
  }

  private get _hasAnyLegacyChannels(): boolean {
    if (undefined === this._hasLegacyChannels) {
      // Check if there are any old-fashion channels defined by legacy iModel Connectors via their Job-Subject's JsonProperties
      this._hasLegacyChannels = this._iModel.withStatement(
        `SELECT 1 FROM ${ChannelAdmin.subjectClassName} WHERE JsonProperties IS NOT NULL AND json_extract(JsonProperties, '$.Subject.Job.Bridge') IS NOT NULL`, (stmt) => stmt.step() === DbResult.BE_SQLITE_ROW, false);
    }
    return this._hasLegacyChannels;
  }
  public get hasChannels(): boolean {
    if (undefined === this._hasChannels) {
      if (this._bisCoreSupportsChannelRootAspect)
        this._hasChannels = this._iModel.withStatement(`SELECT 1 FROM ${ChannelAdmin.channelClassName}`, (stmt) => stmt.step() === DbResult.BE_SQLITE_ROW, false);

      if (undefined === this._hasChannels || !this._hasChannels)
        // There are no channels defined via the ChannelRootAspect class in this iModel.
        // Check for legacy channels for backwards compatibility
        this._hasChannels = this._hasAnyLegacyChannels;
    }
    return this._hasChannels;
  }
  public getChannelKey(elementId: Id64String): ChannelKey {
    if (!this.hasChannels || elementId === IModel.rootSubjectId)
      return ChannelControl.sharedChannelName;

    if (this._bisCoreSupportsChannelRootAspect) {
      const channel = this._iModel.withPreparedStatement(`SELECT Owner FROM ${ChannelAdmin.channelClassName} WHERE Element.Id=?`, (stmt) => {
        stmt.bindId(1, elementId);
        return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValue(0).getString() : undefined;
      });
      if (channel !== undefined)
        return channel;
    }
    if (this._hasAnyLegacyChannels) {
      // FederationGuid of JobSubjects is used as ChannelKey. Legacy Connectors have their own logic to enforce
      // write-operations against those channels. Thus, this approach primarily aims to prevent data changes on
      // those legacy channels by iTwin.js-based code
      const legacyChannel = this._iModel.withPreparedStatement(
        `SELECT FederationGuid FROM ${ChannelAdmin.subjectClassName} WHERE ECInstanceId=? ` +
        `AND json_extract(JsonProperties, '$.Subject.Job.Bridge') IS NOT NULL`, (stmt) => {
          stmt.bindId(1, elementId);
          return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValue(0).getString() : undefined;
        });
      if (legacyChannel !== undefined)
        return legacyChannel;
    }
    const parentId = this._iModel.withPreparedSqliteStatement("SELECT ParentId,ModelId FROM bis_Element WHERE id=?", (stmt) => {
      stmt.bindId(1, elementId);
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        throw new IModelError(IModelStatus.NotFound, "Element does not exist");
      return stmt.getValueId(0) ?? stmt.getValueId(1); // if parent is undefined, use modelId
    });
    return this.getChannelKey(parentId);
  }
  public verifyChannel(modelId: Id64String): void {
    // Note: indirect changes are permitted to change any channel
    if (!this.hasChannels || this._allowedModels.has(modelId) || this._iModel.nativeDb.isIndirectChanges())
      return;

    const deniedChannel = this._deniedModels.get(modelId);
    if (undefined !== deniedChannel)
      throw new IModelError(RepositoryStatus.ChannelConstraintViolation, `channel "${deniedChannel}" is not allowed`);

    const channel = this.getChannelKey(modelId);
    if (this._allowedChannels.has(channel)) {
      this._allowedModels.add(modelId);
      return;
    }
    this._deniedModels.set(modelId, channel);
    return this.verifyChannel(modelId);
  }
  public makeChannelRoot(args: { elementId: Id64String, channelKey: ChannelKey }) {
    if (ChannelControl.sharedChannelName !== this.getChannelKey(args.elementId))
      throw new Error("channels may not nest");

    if (!this._bisCoreSupportsChannelRootAspect)
      throw new Error("BisCore schema v1.0.10 or later is required to make ChannelRoots");

    const props: ChannelRootAspectProps = { classFullName: ChannelAdmin.channelClassName, element: { id: args.elementId }, owner: args.channelKey };
    this._iModel.elements.insertAspect(props);
    this._hasChannels = true;
  }
}
