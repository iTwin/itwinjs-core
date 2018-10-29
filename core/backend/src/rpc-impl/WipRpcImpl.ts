/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { IModelToken, RpcInterface, RpcManager } from "@bentley/imodeljs-common";
import { WipRpcInterface } from "@bentley/imodeljs-common/lib/rpc/WipRpcInterface"; // not part of the "barrel"
import { IModelDb } from "../IModelDb";
import { ChangeSummaryManager } from "../ChangeSummaryManager";

/**
 * The backend implementation of WipRpcInterface.
 * @hidden
 */
export class WipRpcImpl extends RpcInterface implements WipRpcInterface {

  public static register() { RpcManager.registerImpl(WipRpcInterface, WipRpcImpl); }
  public async placeholder(_iModelToken: IModelToken): Promise<string> { return "placeholder"; }

  public async isChangeCacheAttached(iModelToken: IModelToken): Promise<boolean> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    return ChangeSummaryManager.isChangeCacheAttached(IModelDb.find(iModelToken));
  }

  public async attachChangeCache(iModelToken: IModelToken): Promise<void> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    ChangeSummaryManager.attachChangeCache(IModelDb.find(iModelToken));
  }

  public async detachChangeCache(iModelToken: IModelToken): Promise<void> {
    const activityContext = ActivityLoggingContext.current;
    activityContext.enter();
    const iModel: IModelDb = IModelDb.find(iModelToken);
    if (ChangeSummaryManager.isChangeCacheAttached(iModel))
      ChangeSummaryManager.detachChangeCache(iModel);
  }
}
