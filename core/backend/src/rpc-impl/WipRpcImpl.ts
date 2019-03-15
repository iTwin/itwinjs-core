/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { IModelToken, RpcInterface, RpcManager, ChangedElements } from "@bentley/imodeljs-common";
import { WipRpcInterface } from "@bentley/imodeljs-common/lib/rpc/WipRpcInterface"; // not part of the "barrel"
import { IModelDb } from "../IModelDb";
import { ChangeSummaryManager } from "../ChangeSummaryManager";
import { ChangedElementsManager } from "../ChangedElementsManager";

/** The backend implementation of WipRpcInterface.
 * @internal
 */
export class WipRpcImpl extends RpcInterface implements WipRpcInterface {

  public static register() { RpcManager.registerImpl(WipRpcInterface, WipRpcImpl); }
  public async placeholder(_iModelToken: IModelToken): Promise<string> { return "placeholder"; }

  public async isChangeCacheAttached(iModelToken: IModelToken): Promise<boolean> {
    return ChangeSummaryManager.isChangeCacheAttached(IModelDb.find(iModelToken));
  }

  public async attachChangeCache(iModelToken: IModelToken): Promise<void> {
    ChangeSummaryManager.attachChangeCache(IModelDb.find(iModelToken));
  }

  public async detachChangeCache(iModelToken: IModelToken): Promise<void> {
    const iModel: IModelDb = IModelDb.find(iModelToken);
    if (ChangeSummaryManager.isChangeCacheAttached(iModel))
      ChangeSummaryManager.detachChangeCache(iModel);
  }

  public async getChangedElements(iModelToken: IModelToken, startChangesetId: string, endChangesetId: string): Promise<ChangedElements | undefined> {
    return ChangedElementsManager.getChangedElements(iModelToken.iModelId!, startChangesetId, endChangesetId);
  }

  public async isChangesetProcessed(iModelToken: IModelToken, changesetId: string): Promise<boolean> {
    return ChangedElementsManager.isProcessed(iModelToken.iModelId!, changesetId);
  }
}
