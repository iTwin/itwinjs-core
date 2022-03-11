/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert, Id64 } from "@itwin/core-bentley";
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

class IndexBuffer {
  private _data: Uint8Array;
  private _length: number;
  private readonly _index32 = new Uint32Array(1);
  private readonly _index8 = new Uint8Array(this._index32, 0, 3);

  public constructor() {
    this._data = new Uint8Array(9);
    this._length = 0;
  }

  public get length(): number {
    return this._length;
  }

  public push(index: number): void {
    this.reserve(this.length + 3);
    this._index32[0] = index;
    this._data.set(this._index8, this.length * 3);
    this._length += 3;
  }

  private reserve(newSize: number): void {
    if (this._data.length >= newSize)
      return;

    newSize = Math.floor(newSize * 1.5);
    const prevData = this._data;
    this._data = new Uint8Array(newSize);
    this._data.set(prevData, 0);
  }

  public toUint8Array(): Uint8Array {
    return this._data.subarray(0, this.length);
  }
}

class VertexBuffer {
  private _data: Uint32Array;
  private _length: number;
  private readonly _numRgbaPerVertex;

  public constructor(numRgbaPerVertex: number) {
    this._data = new Uint32Array(3 * numRgbaPerVertex);
    this._length = 0;
    this._numRgbaPerVertex = numRgbaPerVertex;
  }

  public get length(): number {
    return this._length;
  }

  public push(vertex: Uint32Array): void {
    assert(vertex.length === this._numRgbaPerVertex);
    this.reserve(this._length + 1);
    this._data.set(vertex, this.length);
    this._length++;
  }

  private reserve(newSize: number): void {
    newSize *= this._numRgbaPerVertex;
    if (this._data.length >= newSize)
      return;

    newSize = Math.floor(newSize * 1.5);
    const prevData = this._data;
    this._data = new Uint32Array(newSize);
    this._data.set(prevData, 0);
  }

  public toUint8Array(): Uint8Array {
    return new Uint8Array(this._data.buffer, 0, this._length * 4 * this._numRgbaPerVertex);
  }
}

class Node {
  public readonly id: number;
  private readonly _remappedIndices = new Map<number, number>();
  private readonly _vertices: VertexBuffer;
  private readonly _indices = new IndexBuffer();

  public constructor(id: number, numRgbaPerVertex: number) {
    this.id = id;
    this._vertices = new VertexBuffer(numRgbaPerVertex);
  }

  public addVertex(originalIndex: number, vertex: Uint32Array): void {
    let newIndex = this._remappedIndices.get(originalIndex);
    if (undefined === newIndex) {
      newIndex = this._vertices.length;
      this._remappedIndices.set(originalIndex, newIndex);
      this._vertices.push(vertex);
    }

    this._indices.push(newIndex);
  }
}

class VertexTableSplitter {
  private readonly _input: VertexTableWithIndices;
  private readonly _computeNodeId: (elementId: Id64.Uint32Pair) => number;
  private readonly _nodes = new Map<number, Node>();

  public constructor(input: VertexTableWithIndices, computeNodeId: (elementId: Id64.Uint32Pair) => number) {
    this._input = input;
    this._computeNodeId = computeNodeId;
    this.split();
  }

  public get result(): Map<number, VertexTableWithIndices> {
    const result = new Map<number, VertexTableWithIndices>();
    return result;
  }

  private split(): void {
    // Track the most recent feature and corresponding node to avoid repeated lookups - vertices for
    // individual features are largely contiguous.
    let curState = {
      featureIndex: -1,
      node: undefined as unknown as Node,
    };

    const vertSize = this._input.vertices.numRgbaPerVertex;
    const vertex = new Uint32Array(vertSize);
    const vertexTable = new Uint32Array(this._input.vertices.data);

    for (const index of this._input.indices) {
      // Extract the data for this vertex without allocating new typed arrays.
      const vertexOffset = index * vertSize;
      for (let i = 0; i < vertex.length; i++)
        vertex[i] = vertexTable[vertexOffset + i];

      // Determine to which element the vertex belongs and find the corresponding Node.
      const featureIndex = vertexTable[index * vertSize] & 0x00ffffff;
      if (curState.featureIndex !== featureIndex) {
        curState.featureIndex = featureIndex;
        const elemId = this._input.featureTable.getElementIdPair(featureIndex);
        const nodeId = this._computeNodeId(elemId);
        let node = this._nodes.get(nodeId);
        if (undefined === node)
          this._nodes.set(nodeId, node = new Node(nodeId, vertSize));

        curState.node = node;
      }

      // Add the vertex to the appropriate node.
      curState.node.addVertex(index, vertex);
    }
  }
}
