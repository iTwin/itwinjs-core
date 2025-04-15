/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FlatBufferGeometryStream, JsonGeometryStream, PlacementProps } from "@itwin/core-common";

/** @packageDocumentation
 * @module Strokers
 */

export abstract class Stroker<T> {
  public abstract createGeometry(props: T, placement?: PlacementProps): FlatBufferGeometryStream | JsonGeometryStream | undefined;

  // public abstract createFlatBufferGeometry(props: T, placement: PlacementProps): Promise<FlatBufferGeometryStream | undefined>;

  // public abstract createGeometryStream(props: T, placement: PlacementProps): Promise<JsonGeometryStream | undefined>;
}