/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { DbResult, Id64String, IModelStatus } from "@itwin/core-bentley";
import { ChannelControlError, ChannelRootAspectProps, IModel, IModelError } from "@itwin/core-common";
import { ChannelControl, ChannelKey } from "../ChannelControl";
import { Subject } from "../Element";
import { IModelDb } from "../IModelDb";
import { IModelHost } from "../IModelHost";
import { _implementationProhibited, _nativeDb, _verifyChannel } from "./Symbols";

class ChannelAdmin implements ChannelControl {
  public static readonly channelClassName = "bis:ChannelRootAspect";

  public readonly [_implementationProhibited] = undefined;
  private _allowedChannels = new Set<ChannelKey>();
  private _allowedModels = new Set<Id64String>();
  private _deniedModels = new Map<Id64String, ChannelKey>();

  public constructor(private _iModel: IModelDb) {
    // for backwards compatibility, allow the shared channel unless explicitly turned off in IModelHostOptions.
    if (IModelHost.configuration?.allowSharedChannel !== false)
      this._allowedChannels.add(ChannelControl.sharedChannelName);
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
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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

  public [_verifyChannel](modelId: Id64String): void {
    // Note: indirect changes are permitted to change any channel
    if (this._allowedModels.has(modelId) || this._iModel[_nativeDb].isIndirectChanges())
      return;

    const deniedChannel = this._deniedModels.get(modelId);
    if (undefined !== deniedChannel)
      ChannelControlError.throwError("not-allowed", `Channel ${deniedChannel} is not allowed`, deniedChannel);

    const channel = this.getChannelKey(modelId);
    if (this._allowedChannels.has(channel)) {
      this._allowedModels.add(modelId);
      return;
    }

    this._deniedModels.set(modelId, channel);
    return this[_verifyChannel](modelId);
  }

  public makeChannelRoot(args: { elementId: Id64String, channelKey: ChannelKey }) {
    const channelKey = this.getChannelKey(args.elementId);
    if (ChannelControl.sharedChannelName !== channelKey)
      ChannelControlError.throwError("may-not-nest", `Channel ${channelKey} may not nest`, channelKey);

    if (this.queryChannelRoot(args.channelKey) !== undefined)
      ChannelControlError.throwError("root-exists", `Channel ${args.channelKey} root already exist`, channelKey);

    const props: ChannelRootAspectProps = { classFullName: ChannelAdmin.channelClassName, element: { id: args.elementId }, owner: args.channelKey };
    this._iModel.elements.insertAspect(props);
  }

  public insertChannelSubject(args: { subjectName: string, channelKey: ChannelKey, parentSubjectId?: Id64String, description?: string }): Id64String {
    // Check if channelKey already exists before inserting Subject.
    // makeChannelRoot will check that again, but at that point the new Subject is already inserted.
    // Prefer to check twice instead of deleting the Subject in the latter option.
    if (this.queryChannelRoot(args.channelKey) !== undefined)
      ChannelControlError.throwError("root-exists", `Channel ${args.channelKey} root already exist`, args.channelKey);

    const elementId = Subject.insert(this._iModel, args.parentSubjectId ?? IModel.rootSubjectId, args.subjectName, args.description);
    this.makeChannelRoot({ elementId, channelKey: args.channelKey });
    return elementId;
  }

  public queryChannelRoot(channelKey: ChannelKey): Id64String | undefined {
    if (channelKey === ChannelControl.sharedChannelName)
      // RootSubject acts as the ChannelRoot element of the shared channel
      return IModel.rootSubjectId;

    try {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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

export function createChannelControl(iModel: IModelDb): ChannelAdmin {
  return new ChannelAdmin(iModel);
}
