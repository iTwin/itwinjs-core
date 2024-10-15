/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, IModelStatus } from "@itwin/core-bentley";
import { ElementGraphicsRequestProps, IModelError } from "@itwin/core-common";
import { ElementGraphicsStatus } from "@bentley/imodeljs-native";
import { IModelDb } from "./IModelDb";
import { _nativeDb } from "./internal/Symbols";

/** See [[IModelDb.generateElementGraphics]] and IModelTileRpcImpl.requestElementGraphics.
 * @internal
 */
export async function generateElementGraphics(request: ElementGraphicsRequestProps, iModel: IModelDb): Promise<Uint8Array | undefined> {
  const result = await iModel[_nativeDb].generateElementGraphics(request as any); // ###TODO update package versions in addon

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
