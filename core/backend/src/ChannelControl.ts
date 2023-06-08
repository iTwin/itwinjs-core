/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { DbResult, Id64String, IModelStatus, RepositoryStatus } from "@itwin/core-bentley";
import { ChannelRootAspectProps, IModel, IModelError } from "@itwin/core-common";
import { Subject } from "./Element";
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
  /** Insert a new Subject element that is a Channel root in this iModel.
   * @returns the ElementId of the new Subject element.
   * @note if the parentSubject element is already in a channel, this will add the Subject element and then throw an error without making it a Channel root.
   */
  insertChannelSubject(args: {
    /** The name of the new Subject element */
    subjectName: string;
    /** The channel key for the new [[Subject]]. This is the string to pass to [[addAllowedChannel]]*/
    channelKey: ChannelKey;
    /** the Id of the parent of the new Subject. Default is [[IModel.rootSubjectId]]. */
    parentSubjectId?: Id64String;
    /** Optional description for new Subject. */
    description?: string;
  }): Id64String;

  /** @internal */
  verifyChannel(modelId: Id64String): void;
}

/** @internal */
export class ChannelAdmin implements ChannelControl {
  /** the name of the special "shared" channel holding information that is editable by any application. */
  public static readonly sharedChannel = "shared";
  public static readonly channelClassName = "bis:ChannelRootAspect";
  private _allowedChannels = new Set<ChannelKey>();
  private _allowedModels = new Set<Id64String>();
  private _deniedModels = new Map<Id64String, ChannelKey>();
  private _hasChannels?: boolean;

  public constructor(private _iModel: IModelDb) {
    this._allowedChannels.add(ChannelAdmin.sharedChannel);
  }
  public addAllowedChannel(channelKey: ChannelKey) {
    this._allowedChannels.add(channelKey);
    this._deniedModels.clear();
  }
  public removeAllowedChannel(channelKey: ChannelKey) {
    this._allowedChannels.delete(channelKey);
    this._allowedModels.clear();
  }
  public get hasChannels(): boolean {
    if (undefined === this._hasChannels) {
      try {
        this._hasChannels = this._iModel.withStatement(`SELECT 1 FROM ${ChannelAdmin.channelClassName}`, (stmt) => stmt.step() === DbResult.BE_SQLITE_ROW, false);
      } catch (e) {
        // iModel doesn't have channel class in its BIS schema
        this._hasChannels = false;
      }
    }
    return this._hasChannels;
  }
  public getChannelKey(elementId: Id64String): ChannelKey {
    if (!this.hasChannels || elementId === IModel.rootSubjectId)
      return ChannelAdmin.sharedChannel;

    const channel = this._iModel.withPreparedStatement(`SELECT Owner FROM ${ChannelAdmin.channelClassName} WHERE Element.Id=?`, (stmt) => {
      stmt.bindId(1, elementId);
      return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValue(0).getString() : undefined;
    });
    if (channel !== undefined)
      return channel;
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
    if (ChannelAdmin.sharedChannel !== this.getChannelKey(args.elementId))
      throw new Error("channels may not nest");

    const props: ChannelRootAspectProps = { classFullName: ChannelAdmin.channelClassName, element: { id: args.elementId }, owner: args.channelKey };
    this._iModel.elements.insertAspect(props);
    this._hasChannels = true;
  }
  public insertChannelSubject(args: { subjectName: string, channelKey: ChannelKey, parentSubjectId?: Id64String, description?: string }): Id64String {
    const elementId = Subject.insert(this._iModel, args.parentSubjectId ?? IModel.rootSubjectId, args.subjectName, args.description);
    this.makeChannelRoot({ elementId, channelKey: args.channelKey });
    return elementId;
  }
}
