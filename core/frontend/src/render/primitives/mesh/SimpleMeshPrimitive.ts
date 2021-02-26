/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { OctEncodedNormal, QPoint2dList, QPoint3dList } from "@bentley/imodeljs-common";
import { RenderMemory } from "../../RenderMemory";

/**
 * @internal.
 */

export abstract class SimpleMeshPrimitive implements RenderMemory.Consumer {
  public readonly indices: number[];
  public readonly points: QPoint3dList;
  public readonly normals: OctEncodedNormal[];
  public readonly uvParams: QPoint2dList;
  public readonly featureID: number = 0;

  protected constructor(indices: number[], points: QPoint3dList, uvParams: QPoint2dList, normals: OctEncodedNormal[]) {
    this.points = points;
    this.uvParams = uvParams;
    this.normals = normals;
    this.indices = indices;
  }

  public get bytesUsed() {
    return 8 * (this.indices.length + this.points.length * 3 + this.uvParams.length * 2) + 2 * this.normals.length;
  }
  public abstract collectStatistics(stats: RenderMemory.Statistics): void;
}
