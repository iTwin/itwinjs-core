/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelConnection } from "@itwin/core-frontend";

/** @internal */
export interface IModelConnectionInitializationHandler {
  startInitialization: (imodel: IModelConnection) => void;
  ensureInitialized: (imodel: IModelConnection) => Promise<void>;
}

/** @internal */
export const imodelInitializationHandlers = new Set<IModelConnectionInitializationHandler>();

/** @internal */
export function startIModelInitialization(imodel: IModelConnection) {
  for (const { startInitialization } of imodelInitializationHandlers) {
    startInitialization(imodel);
  }
}

/** @internal */
export async function ensureIModelInitialized(imodel: IModelConnection) {
  await Promise.all([...imodelInitializationHandlers].map(async ({ ensureInitialized }) => ensureInitialized(imodel)));
}
