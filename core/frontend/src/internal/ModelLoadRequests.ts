/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "../IModelConnection";

interface ModelLoadRequest { promise: Promise<void>, owner?: string }

// Models.load owns the requests; display references subscribe to the batches containing their IDs.
export const modelLoadRequests = new WeakMap<IModelConnection.Models, Map<Id64String, ModelLoadRequest>>();

/** Stop offering this owner's pending data to new callers, without canceling work already promised to anyone. */
export function retireModelRequests(models: IModelConnection.Models, owner: string): void {
  const requests = modelLoadRequests.get(models);
  if (requests)
    for (const [id, request] of requests)
      if (request.owner === owner)
        requests.delete(id);
}
