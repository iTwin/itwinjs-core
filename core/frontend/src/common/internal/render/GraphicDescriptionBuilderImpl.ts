/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Transform, TransformProps } from "@itwin/core-geometry";
import { ImdlModel, addPrimitiveTransferables } from "../../imdl/ImdlModel";
import { ComputeGraphicDescriptionChordToleranceArgs, GraphicDescription, GraphicDescriptionBuilder, GraphicDescriptionBuilderOptions } from "../../render/GraphicDescriptionBuilder";
import { GraphicType } from "../../render/GraphicType";
import { GraphicAssembler } from "../../render/GraphicAssembler";

export interface GraphicDescriptionImpl extends GraphicDescription {
  type: GraphicType;
  primitives: ImdlModel.Primitive[];
  transform?: TransformProps;
}

export class GraphicDescriptionBuilderImpl extends GraphicAssembler implements GraphicDescriptionBuilder {
  private readonly _computeChordTolerance: (args: ComputeGraphicDescriptionChordToleranceArgs) => number;
  
  public constructor(options: GraphicDescriptionBuilderOptions) {
    const type = options.type;
    const placement = options.placement ?? Transform.createIdentity();
    const wantEdges = options.generateEdges ?? type === GraphicType.Scene;
    const wantNormals = wantEdges || type === GraphicType.Scene;
    const preserveOrder = type === GraphicType.ViewOverlay || type === GraphicType.WorldOverlay || type === GraphicType.ViewBackground;

    super({ ...options, type, placement, wantEdges, wantNormals, preserveOrder });

    this._computeChordTolerance = options.computeChordTolerance;
  }

  public finish(): GraphicDescription {
    // ###TODO
    return { primitives: [] };
  }

  protected override resolveGradient() {
    // ###TODO support textures and materials.
    return undefined;
  }
}

export function isGraphicDescription(description: GraphicDescription): description is GraphicDescriptionImpl {
  const descr = description as any;
  if ("object" !== typeof descr || !Array.isArray(descr.primitives)) {
    return false;
  }

  switch (descr.type) {
    case GraphicType.ViewBackground:
    case GraphicType.Scene:
    case GraphicType.WorldDecoration:
    case GraphicType.WorldOverlay:
    case GraphicType.ViewOverlay:
      return true;
    default:
      return false;
  }
}

export function collectGraphicDescriptionTransferables(description: GraphicDescription): Transferable[] {
  if (!isGraphicDescription(description)) {
    throw new Error("Invalid GraphicDescription");
  }

  const xfers = new Set<Transferable>();
  for (const primitive of description.primitives) {
    addPrimitiveTransferables(xfers, primitive);
  }

  return Array.from(xfers);
}

