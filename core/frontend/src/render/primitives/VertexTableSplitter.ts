/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64 } from "@itwin/core-bentley";
import { VertexTableWithIndices } from "./VertexTable";

/** Given a VertexTable and corresponding indices, split it into smaller vertex tables based on element Id.
 * @param input The original VertexTable and the indices defining the geometry.
 * @param computeNodeId A function that accepts an element Id and returns the unsigned integer Id of the node to which it belongs.
 * @returns A mapping of node Ids to the vertices and indices associated with that node.
 * @internal
 */
export function splitVerticesByNodeId(input: VertexTableWithIndices, computeNodeId: (elementId: Id64.Uint32Pair) => number): Map<number, VertexTableWithIndices> {
  const splitter = new VertexTableSplitter(input, computeNodeId);
  return splitter.result;
}

class VertexTableSplitter {
  public readonly result = new Map<number, VertexTableWithIndices>();

  public constructor(private readonly _input: VertexTableWithIndices, private readonly _computeNodeId: (elementId: Id64.Uint32Pair) => number) {
    this.split();
  }

  private split(): void {
  }
}
