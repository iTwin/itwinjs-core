/*---------------------------------------------------------------------------------------------
 * Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */
import { Id64String, Id64, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import { AxisAlignedBox3d, RpcInterface, RpcManager, IModel, IModelToken, IModelWriteRpcInterface, ThumbnailProps, ImageSourceFormat, ElementProps } from "@bentley/imodeljs-common";
import { IModelDb, OpenParams, ExclusiveAccessOption } from "../IModelDb";
import { OpenIModelDbMemoizer } from "./OpenIModelDbMemoizer";

/**
 * The backend implementation of IModelWriteRpcInterface.
 * @hidden
 */
export class IModelWriteRpcImpl extends RpcInterface implements IModelWriteRpcInterface {
  public static register() { RpcManager.registerImpl(IModelWriteRpcInterface, IModelWriteRpcImpl); }

  public async openForWrite(accessToken: AccessToken, iModelToken: IModelToken): Promise<IModel> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    return OpenIModelDbMemoizer.openIModelDb(activityContext, AccessToken.fromJson(accessToken)!, iModelToken, OpenParams.pullAndPush(ExclusiveAccessOption.TryReuseOpenBriefcase));
  }

  public async saveChanges(iModelToken: IModelToken, description?: string): Promise<void> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    IModelDb.find(iModelToken).saveChanges(description);
  }
  public async updateProjectExtents(iModelToken: IModelToken, newExtents: AxisAlignedBox3d): Promise<void> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    IModelDb.find(iModelToken).updateProjectExtents(newExtents);
  }

  public async saveThumbnail(iModelToken: IModelToken, val: Uint8Array): Promise<void> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    const int16Val = new Uint16Array(val.buffer);
    const int32Val = new Uint32Array(val.buffer);
    const props: ThumbnailProps = { format: int16Val[1] === ImageSourceFormat.Jpeg ? "jpeg" : "png", width: int16Val[2], height: int16Val[3], image: new Uint8Array(val.buffer, 16, int16Val[0]) };
    const id = Id64.fromLocalAndBriefcaseIds(int32Val[2], int32Val[3]);
    if (!Id64.isValid(id) || props.width === undefined || props.height === undefined || props.image.length <= 0)
      return Promise.reject(new Error("bad args"));

    if (0 !== IModelDb.find(iModelToken).views.saveThumbnail(id, props))
      return Promise.reject(new Error("failed to save thumbnail"));

    return Promise.resolve();
  }
  public async insertElement(iModelToken: IModelToken, elementProps: ElementProps): Promise<Id64String> {
    return IModelDb.find(iModelToken).elements.insertElement(elementProps);
  }
}
