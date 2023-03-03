/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { DbResult, Id64String, RepositoryStatus } from "@itwin/core-bentley";
import { ChannelRootAspectProps, IModel, IModelError } from "@itwin/core-common";
import { Subject } from "./Element";
import { ElementUniqueAspect } from "./ElementAspect";
import { IModelDb } from "./IModelDb";

export type ChannelName = string;

export class ChannelAdmin {
  public static readonly sharedChannel = "shared";
  /** @internal */
  public static readonly channelClassName = "bis:ChannelRootAspect";
  private _allowedModels!: Set<string>;
  private _deniedModels!: Map<string, string>;
  private _allowedChannels = new Set<string>();

  public constructor(private _iModel: IModelDb) {
    this.reset();
  }

  private reset() {
    this._allowedChannels = new Set<string>();
    this._allowedChannels.add(ChannelAdmin.sharedChannel);
    this._deniedModels = new Map<string, string>();
  }
  public addAllowedChannel(channelName: ChannelName) {
    this.reset();
    this._allowedChannels.add(channelName);
  }
  public removeAllowedChannel(channelName: ChannelName) {
    this.reset();
    this._allowedChannels.delete(channelName);
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
    const parentId = this._iModel.withPreparedSqliteStatement("SELECT ParentId FROM bis_Element WHERE id=?", (stmt) => {
      stmt.bindId(1, elementId);
      return DbResult.BE_SQLITE_ROW !== stmt.step() ? IModel.rootSubjectId : stmt.getValueId(0);
    });
    return this.getChannel(parentId);
  }

  public verifyChannel(model: Id64String, operation: string): void {
    if (this._allowedModels.has(model))
      return;

    const deniedChannel = this._deniedModels.get(model);
    if (undefined !== deniedChannel)
      throw new IModelError(RepositoryStatus.ChannelConstraintViolation, `channel ${deniedChannel} is not allowed for ${operation}`);

    const channel = this.getChannel(model);
    if (this._allowedChannels.has(channel)) {
      this._allowedModels.add(model);
      return;
    }
    this._deniedModels.set(model, channel);
    return this.verifyChannel(model, operation);
  }

  public insertChannelSubject(args: { parentSubjectId: Id64String, subjectName: string, channelName: ChannelName, description?: string }): Id64String {
    if (ChannelAdmin.sharedChannel !== this.getChannel(args.parentSubjectId))
      throw new Error("channels may not nest");

    const subjectId = Subject.insert(this._iModel, args.parentSubjectId, args.subjectName, args.description);
    const props: ChannelRootAspectProps = { classFullName: ChannelAdmin.channelClassName, element: { id: subjectId }, owner: args.channelName };
    this._iModel.elements.insertAspect(props);
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
