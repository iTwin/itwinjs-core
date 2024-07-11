/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { Transform, Point3d } from "@itwin/core-geometry";
import { AnalysisStyle, Feature, GraphicParams } from "@itwin/core-common";
// ###TODO import { _implementationProhibited } from "../../internal/Symbols";
import { GraphicType } from "./GraphicType";
import { PickableGraphicOptions } from "./BatchOptions";

export interface GraphicAssembler {
  /** @internal */
  // ###TODO [_implementationProhibited]: unknown;
  
  readonly placement: Transform;
  readonly type: GraphicType;
  readonly pickable?: Readonly<PickableGraphicOptions>;
  readonly preserveOrder: boolean;
  readonly wantNormals: boolean;
  readonly wantEdges: boolean;
  /** @alpha */
  readonly analysisStyle?: AnalysisStyle;

  activateGraphicParams(params:GraphicParams): void;
  activateFeature(feature: Feature): void;
  activatePickableId(id: Id64String): void;

  addLineString(points: Point3d[]): void;
}
