/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, ClientRequestContext, IModelStatus } from "@bentley/bentleyjs-core";
import { ElementGraphicsRequestProps, IModelError } from "@bentley/imodeljs-common";
import { ElementGraphicsStatus } from "@bentley/imodeljs-native";
import { IModelDb } from "./IModelDb";

/** See [[IModelDb.generateElementGraphics]] and IModelTileRpcImpl.requestElementGraphics.
 * @internal
 */
export async function generateElementGraphics(request: ElementGraphicsRequestProps, iModel: IModelDb): Promise<Uint8Array | undefined> {
  const requestContext = ClientRequestContext.current;
  const result = await iModel.nativeDb.generateElementGraphics(request);

  requestContext.enter();
  let error: string | undefined;
  switch (result.status) {
    case ElementGraphicsStatus.NoGeometry:
    case ElementGraphicsStatus.Canceled:
      return undefined;
    case ElementGraphicsStatus.Success:
      return result.content;
    case ElementGraphicsStatus.InvalidJson:
      error = "Invalid JSON";
      break;
    case ElementGraphicsStatus.UnknownMajorFormatVersion:
      error = "Unknown major format version";
      break;
    case ElementGraphicsStatus.ElementNotFound:
      error = `Element Id ${request.elementId} not found`;
      break;
    case ElementGraphicsStatus.DuplicateRequestId:
      error = `Duplicate request Id "${request.id}"`;
      break;
  }

  assert(undefined !== error);
  throw new IModelError(IModelStatus.BadRequest, error);
}
