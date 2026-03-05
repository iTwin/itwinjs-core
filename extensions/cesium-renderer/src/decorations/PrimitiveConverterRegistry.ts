/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { GraphicList, IModelConnection } from "@itwin/core-frontend";
import type { CesiumScene } from "../CesiumScene.js";
import type { DecorationPrimitiveEntry } from "./DecorationTypes.js";

export type PrimitiveConverterLookup = (
  geometryType?: DecorationPrimitiveEntry["type"]
) => PrimitiveConverterLike | undefined;

export interface PrimitiveConverterLike {
  convertDecorations: (
    graphics: GraphicList,
    type: string,
    scene: CesiumScene,
    iModel?: IModelConnection
  ) => void;
}

let primitiveConverterLookup: PrimitiveConverterLookup | undefined;

export function setPrimitiveConverterLookup(lookup: PrimitiveConverterLookup): void {
  primitiveConverterLookup = lookup;
}

export function getPrimitiveConverterLookup(): PrimitiveConverterLookup | undefined {
  return primitiveConverterLookup;
}
