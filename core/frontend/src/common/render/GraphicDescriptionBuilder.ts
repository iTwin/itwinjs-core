/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { GraphicAssembler } from "./GraphicAssembler";
import { collectGraphicDescriptionTransferables } from "../internal/render/GraphicDescriptionBuilderImpl";

export interface GraphicDescription {
  // ###TODO [_implementationProhibited]
}

export namespace GraphicDescription {
  export function collectTransferables(description: GraphicDescription): Transferable[] {
    return collectGraphicDescriptionTransferables(description);
  }
}

export interface GraphicDescriptionBuilder extends GraphicAssembler {
  // ###TODO [_implementationProhibited]
  finish(): GraphicDescription;
}
