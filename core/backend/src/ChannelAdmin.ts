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
import { ElementUniqueAspect } from "./ElementAspect";
import { IModelDb } from "./IModelDb";

export type ChannelName = string;

export class ChannelAdmin {
  public static readonly sharedChannel = "shared";
  /** @internal */
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
      this._hasChannels = false;
      try {
        this._hasChannels = this._iModel.withStatement(`SELECT count(*) FROM ${ChannelAdmin.channelClassName}`, (stmt) => {
          return stmt.step() === DbResult.BE_SQLITE_ROW ? (stmt.getValue(0).getInteger() > 0) : false;
        }, false);
      } catch (e) {
        // iModel doesn't have channel class in its BIS schema
      }
    }
    return this._hasChannels;
  }

  public getChannel(elementId: Id64String): ChannelName {
    if (elementId === IModel.rootSubjectId)
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

  public insertChannelSubject(args: { parentSubjectId: Id64String, subjectName: string, channelName: ChannelName, description?: string }): Id64String {
    if (ChannelAdmin.sharedChannel !== this.getChannel(args.parentSubjectId))
      throw new Error("channels may not nest");

    const subjectId = Subject.insert(this._iModel, args.parentSubjectId, args.subjectName, args.description);
    const props: ChannelRootAspectProps = { classFullName: ChannelAdmin.channelClassName, element: { id: subjectId }, owner: args.channelName };
    this._iModel.elements.insertAspect(props);
    this._hasChannels = true;
    return subjectId;
  }
}

/**
 * @public
 * @deprecated in 4.0 use [[ChannelAdmin]]
 */
export class ChannelRootAspect extends ElementUniqueAspect {
  private constructor(props: ChannelRootAspectProps, iModel: IModelDb) {
    super(props, iModel);
  }

  /** Insert a ChannelRootAspect on the specified element.
   * @deprecated in 4.0 use [[ChannelAdmin.insertChannelSubject]]
   */
  public static insert(iModel: IModelDb, ownerId: Id64String, channelName: ChannelName) {
    const props: ChannelRootAspectProps = { classFullName: ChannelAdmin.channelClassName, element: { id: ownerId }, owner: channelName };
    iModel.elements.insertAspect(props);
  }
}
