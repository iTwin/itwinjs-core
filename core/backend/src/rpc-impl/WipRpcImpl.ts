/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { ChangedElements, IModelToken, IModelTokenProps, RpcInterface, RpcManager } from "@bentley/imodeljs-common";
import { WipRpcInterface } from "@bentley/imodeljs-common/lib/rpc/WipRpcInterface"; // not part of the "barrel"
import { ChangedElementsManager } from "../ChangedElementsManager";
import { ChangeSummaryManager } from "../ChangeSummaryManager";
import { BriefcaseDb } from "../IModelDb";

/** The backend implementation of WipRpcInterface.
 * @internal
 */
export class WipRpcImpl extends RpcInterface implements WipRpcInterface {

  public static register() { RpcManager.registerImpl(WipRpcInterface, WipRpcImpl); }
  public async placeholder(_tokenProps: IModelTokenProps): Promise<string> { return "placeholder"; }

  public async isChangeCacheAttached(tokenProps: IModelTokenProps): Promise<boolean> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    return ChangeSummaryManager.isChangeCacheAttached(BriefcaseDb.findByToken(iModelToken));
  }

  public async attachChangeCache(tokenProps: IModelTokenProps): Promise<void> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    ChangeSummaryManager.attachChangeCache(BriefcaseDb.findByToken(iModelToken));
  }

  public async detachChangeCache(tokenProps: IModelTokenProps): Promise<void> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const iModel: BriefcaseDb = BriefcaseDb.findByToken(iModelToken);
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
