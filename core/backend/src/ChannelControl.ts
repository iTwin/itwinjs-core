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
   * @throws if the element is already in a channel different than the shared channel, or if
   * there is already another channelRoot element for the specified channelKey
   */
  makeChannelRoot(args: { elementId: Id64String, channelKey: ChannelKey }): void;
  /** Insert a new Subject element that is a Channel Root in this iModel.
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
  /**
   * Queries for the element Id acting as the ChannelRoot for a given channelKey, if any
   * @param channelKey The key for the channel to query for
   * @returns The element Id of the ChannelRoot element of the specified Channel key, or undefined if
   * there is no ChannelRoot for it
   */
  queryChannelRoot(channelKey: ChannelKey): Id64String | undefined

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
  public static readonly channelClassName = "bis:ChannelRootAspect";
  private _allowedChannels = new Set<ChannelKey>();
  private _allowedModels = new Set<Id64String>();
  private _deniedModels = new Map<Id64String, ChannelKey>();

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
  public getChannelKey(elementId: Id64String): ChannelKey {
    if (elementId === IModel.rootSubjectId)
      return ChannelControl.sharedChannelName;

    try {
      const channel = this._iModel.withPreparedStatement(`SELECT Owner FROM ${ChannelAdmin.channelClassName} WHERE Element.Id=?`, (stmt) => {
        stmt.bindId(1, elementId);
        return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValue(0).getString() : undefined;
      });
      if (channel !== undefined)
        return channel;
    } catch {
      // Exception happens if the iModel is too old: ChannelRootAspect class not present in the BisCore schema (older than v1.0.10).
      // In that case all data in such iModel is assumed to be in the shared channel.
      return ChannelControl.sharedChannelName;
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
    if (this._allowedModels.has(modelId) || this._iModel.nativeDb.isIndirectChanges())
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

    if (this.queryChannelRoot(args.channelKey) !== undefined)
      throw new Error("a channel root for the specified key already exists");

    const props: ChannelRootAspectProps = { classFullName: ChannelAdmin.channelClassName, element: { id: args.elementId }, owner: args.channelKey };
    this._iModel.elements.insertAspect(props);
  }
  public insertChannelSubject(args: { subjectName: string, channelKey: ChannelKey, parentSubjectId?: Id64String, description?: string }): Id64String {
    // Check if channelKey already exists before inserting Subject.
    // makeChannelRoot will check that again, but at that point the new Subject is already inserted.
    // Prefer to check twice instead of deleting the Subject in the latter option.
    if (this.queryChannelRoot(args.channelKey) !== undefined)
      throw new Error("a channel root for the specified key already exists");

    const elementId = Subject.insert(this._iModel, args.parentSubjectId ?? IModel.rootSubjectId, args.subjectName, args.description);
    this.makeChannelRoot({ elementId, channelKey: args.channelKey });
    return elementId;
  }
  public queryChannelRoot(channelKey: ChannelKey): Id64String | undefined {
    if (channelKey === ChannelControl.sharedChannelName)
      // RootSubject acts as the ChannelRoot element of the shared channel
      return IModel.rootSubjectId;

    try {
      const channelRoot = this._iModel.withPreparedStatement(`SELECT Element.Id FROM ${ChannelAdmin.channelClassName} WHERE Owner=?`, (stmt) => {
        stmt.bindString(1, channelKey);
        return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValue(0).getId() : undefined;
      });
      return channelRoot;
    } catch {
      // Exception happens if the iModel is too old: ChannelRootAspect class not present in the BisCore schema (older than v1.0.10).
      // In that case all data in such iModel is assumed to be in the shared channel.
      return undefined;
    }

  }
}
