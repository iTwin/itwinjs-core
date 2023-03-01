/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { DbResult, Id64String, RepositoryStatus } from "@itwin/core-bentley";
import { IModel, IModelError } from "@itwin/core-common";
import { ChannelRootAspect } from "./ElementAspect";
import { IModelDb } from "./IModelDb";

export class ChannelAdmin {
  private static _root = "root";
  private _allowedModels!: Set<string>;
  private _deniedModels!: Map<string, string>;
  private _allowedChannels = new Set<string>();

  public constructor(private _iModel: IModelDb) {
    this.reset();
  }

  private reset() {
    this._allowedChannels = new Set<string>();
    this._allowedChannels.add(ChannelAdmin._root);
    this._deniedModels = new Map<string, string>();
  }
  public addAllowedChannel(channelName: string) {
    this.reset();
    this._allowedChannels.add(channelName);
  }
  public removeAllowedChannel(channelName: string) {
    this.reset();
    this._allowedChannels.delete(channelName);
  }

  public getChannelForModel(modelId: Id64String): string {
    if (modelId === IModel.rootSubjectId)
      return ChannelAdmin._root;

    const channel = this._iModel.withPreparedStatement(`SELECT Owner FORM ${ChannelRootAspect.classFullName} WHERE Element.Id=?`, (stmt) => {
      stmt.bindId(1, modelId);
      return DbResult.BE_SQLITE_ROW === stmt.step() ? stmt.getValue(0).getString() : undefined;
    });
    if (channel !== undefined)
      return channel;
    const parentId = this._iModel.withPreparedSqliteStatement("SELECT ParentId FROM bis_Element WHERE id=?", (stmt) => {
      stmt.bindId(1, modelId);
      return DbResult.BE_SQLITE_ROW !== stmt.step() ? IModel.rootSubjectId : stmt.getValueId(0);
    });
    return this.getChannelForModel(parentId);
  }

  public verifyChannel(model: Id64String, operation: string): void {
    if (this._allowedModels.has(model))
      return;

    const deniedChannel = this._deniedModels.get(model);
    if (undefined !== deniedChannel)
      throw new IModelError(RepositoryStatus.ChannelConstraintViolation, `channel ${deniedChannel} is not allowed for ${operation}`);

    const channel = this.getChannelForModel(model);
    if (this._allowedChannels.has(channel)) {
      this._allowedModels.add(model);
      return;
    }
    this._deniedModels.set(model, channel);
    return this.verifyChannel(model, operation);
  }
}
