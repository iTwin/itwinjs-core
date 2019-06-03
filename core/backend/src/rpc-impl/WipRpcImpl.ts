/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface, RpcManager, ChangedElements, IModelToken, IModelTokenProps } from "@bentley/imodeljs-common";
import { WipRpcInterface } from "@bentley/imodeljs-common/lib/rpc/WipRpcInterface"; // not part of the "barrel"
import { IModelDb } from "../IModelDb";
import { ChangeSummaryManager } from "../ChangeSummaryManager";
import { ChangedElementsManager } from "../ChangedElementsManager";

/** The backend implementation of WipRpcInterface.
 * @internal
 */
export class WipRpcImpl extends RpcInterface implements WipRpcInterface {

  public static register() { RpcManager.registerImpl(WipRpcInterface, WipRpcImpl); }
  public async placeholder(_tokenProps: IModelTokenProps): Promise<string> { return "placeholder"; }

  public async isChangeCacheAttached(tokenProps: IModelTokenProps): Promise<boolean> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    return ChangeSummaryManager.isChangeCacheAttached(IModelDb.find(iModelToken));
  }

  public async attachChangeCache(tokenProps: IModelTokenProps): Promise<void> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    ChangeSummaryManager.attachChangeCache(IModelDb.find(iModelToken));
  }

  public async detachChangeCache(tokenProps: IModelTokenProps): Promise<void> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const iModel: IModelDb = IModelDb.find(iModelToken);
    if (ChangeSummaryManager.isChangeCacheAttached(iModel))
      ChangeSummaryManager.detachChangeCache(iModel);
  }

  public async getChangedElements(tokenProps: IModelTokenProps, startChangesetId: string, endChangesetId: string): Promise<ChangedElements | undefined> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    return ChangedElementsManager.getChangedElements(iModelToken.iModelId!, startChangesetId, endChangesetId);
  }

  public async isChangesetProcessed(tokenProps: IModelTokenProps, changesetId: string): Promise<boolean> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    return ChangedElementsManager.isProcessed(iModelToken.iModelId!, changesetId);
  }
}
