/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

/* eslint-disable @typescript-eslint/no-deprecated */

import { assert } from "@itwin/core-bentley";
import { ChangedElements, IModelRpcProps, RpcInterface, RpcManager, WipRpcInterface } from "@itwin/core-common";
import { ChangedElementsManager } from "../ChangedElementsManager";
import { ChangeSummaryManager } from "../ChangeSummaryManager";
import { BriefcaseDb } from "../IModelDb";

/** The backend implementation of WipRpcInterface.
 * @internal
 * @deprecated in 4.10. If any of these methods are needed in the frontend, they should be rewritten using IPC or HTTP protocol.
 */
export class WipRpcImpl extends RpcInterface implements WipRpcInterface {

  public static register() { RpcManager.registerImpl(WipRpcInterface, WipRpcImpl); }
  public async placeholder(_tokenProps: IModelRpcProps): Promise<string> { return "placeholder"; }

  public async isChangeCacheAttached(tokenProps: IModelRpcProps): Promise<boolean> {
    return ChangeSummaryManager.isChangeCacheAttached(BriefcaseDb.findByKey(tokenProps.key));
  }

  public async attachChangeCache(tokenProps: IModelRpcProps): Promise<void> {
    ChangeSummaryManager.attachChangeCache(BriefcaseDb.findByKey(tokenProps.key));
  }

  public async getChangedElements(tokenProps: IModelRpcProps, startChangesetId: string, endChangesetId: string): Promise<ChangedElements | undefined> {
    assert(undefined !== tokenProps.iModelId);
    return ChangedElementsManager.getChangedElements(tokenProps.iModelId, startChangesetId, endChangesetId);
  }

  public async isChangesetProcessed(tokenProps: IModelRpcProps, changesetId: string): Promise<boolean> {
    assert(undefined !== tokenProps.iModelId);
    return ChangedElementsManager.isProcessed(tokenProps.iModelId, changesetId);
  }
}
