/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { GraphicAssembler } from "./GraphicAssembler";
import { ImdlModel, addPrimitiveTransferables } from "../imdl/ImdlModel";
import { TransformProps } from "@itwin/core-geometry";

export interface GraphicDescription {
  // ###TODO [_implementationProhibited]

  // ###TODO move implementation details to GraphicDescriptionImpl
  primitives: ImdlModel.Primitive[];
  transform?: TransformProps;
}

export namespace GraphicDescription {
  export function collectTransferables(description: GraphicDescription): Transferable[] {
    const xfers = new Set<Transferable>();
    for (const primitive of description.primitives) {
      addPrimitiveTransferables(xfers, primitive);
    }

    return Array.from(xfers);
  }
}

export interface GraphicDescriptionBuilder extends GraphicAssembler {
  // ###TODO [_implementationProhibited]
  finish(): GraphicDescription;
}

export class GraphicDescriptionBuilderImpl extends GraphicAssembler implements GraphicDescriptionBuilder {
  public finish(): GraphicDescription {
    // ###TODO
    return { primitives: [] };
  }

  protected override resolveGradient() {
    // ###TODO support textures.
    return undefined;
  }
}
