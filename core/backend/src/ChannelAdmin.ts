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

/** The name of a channel. Used for "allowed channels" in [[ChannelAdmin]] */
export type ChannelName = string;

/**
 * Controls which channels of an iModel are permitted for write operations. An instance of this class is
 * available via [[IModelDb.channels]].
 * @see [Working With Channels]($docs/learning/backend/channels.md) for details
 * @beta
 */
export interface ChannelControl {
  /** Determine whether this [[IModelDb]] has any channels in it. */
  get hasChannels(): boolean;
  /** Add a new channel to the list of allowed channels of the [[IModelDb]] for this session.
   * @param channelName The name of the channel to become editable in this session.
   */
  addAllowedChannel(channelName: ChannelName): void;
  /** Remove a channel from the list of allowed channels of the [[IModelDb]] for this session.
   * @param channelName The name of the channel that should no longer be editable in this session.
   */
  removeAllowedChannel(channelName: ChannelName): void;
  /** Get the channelName of the channel for an element by ElementId.
   * @throws if the element does not exist
   */
  getChannel(elementId: Id64String): ChannelName;
  /** Insert a new Subject element that defines a new Channel in this iModel.
   * @returns the ElementId of the new Subject element.
   */
  insertChannelSubject(args: {
    /** The name of the new Subject element */
    subjectName: string;
    /** The channel name for the new [[Subject]]. This is the string to pass to [[addAllowedChannel]]*/
    channelName: ChannelName;
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
  private _allowedChannels = new Set<ChannelName>();
  private _allowedModels = new Set<Id64String>();
  private _deniedModels = new Map<Id64String, ChannelName>();
  private _hasChannels?: boolean;

  public constructor(private _iModel: IModelDb) {
    this._allowedChannels.add(ChannelAdmin.sharedChannel);
  }
  public addAllowedChannel(channelName: ChannelName) {
    this._allowedChannels.add(channelName);
    this._deniedModels.clear();
  }
  public removeAllowedChannel(channelName: ChannelName) {
    this._allowedChannels.delete(channelName);
    this._allowedModels.clear();
  }
  public get hasChannels(): boolean {
    if (undefined === this._hasChannels) {
      try {
        this._hasChannels = this._iModel.withStatement(`SELECT Owner FROM ${ChannelAdmin.channelClassName}`, (stmt) => stmt.step() === DbResult.BE_SQLITE_ROW, false);
      } catch (e) {
        // iModel doesn't have channel class in its BIS schema
        this._hasChannels = false;
      }
    }
    return this._hasChannels;
  }
  public getChannel(elementId: Id64String): ChannelName {
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
    return this.getChannel(parentId);
  }
  public verifyChannel(modelId: Id64String): void {
    if (!this.hasChannels || this._allowedModels.has(modelId))
      return;

    const deniedChannel = this._deniedModels.get(modelId);
    if (undefined !== deniedChannel)
      throw new IModelError(RepositoryStatus.ChannelConstraintViolation, `ChannelAdmin: channel "${deniedChannel}" is not allowed`);

    const channel = this.getChannel(modelId);
    if (this._allowedChannels.has(channel)) {
      this._allowedModels.add(modelId);
      return;
    }
    this._deniedModels.set(modelId, channel);
    return this.verifyChannel(modelId);
  }
  public insertChannelSubject(args: { subjectName: string, channelName: ChannelName, parentSubjectId?: Id64String, description?: string }): Id64String {
    if (args.parentSubjectId && ChannelAdmin.sharedChannel !== this.getChannel(args.parentSubjectId))
      throw new Error("channels may not nest");

    const subjectId = Subject.insert(this._iModel, args.parentSubjectId ?? IModel.rootSubjectId, args.subjectName, args.description);
    const props: ChannelRootAspectProps = { classFullName: ChannelAdmin.channelClassName, element: { id: subjectId }, owner: args.channelName };
    this._iModel.elements.insertAspect(props);
    this._hasChannels = true;
    return subjectId;
  }
}
