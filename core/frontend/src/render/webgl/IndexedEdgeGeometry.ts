/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { dispose } from "@itwin/core-bentley";
import { EdgeTable } from "../primitives/EdgeParams";
import { TextureHandle } from "./Texture";
import { BufferHandle, BuffersContainer } from "./AttributeBuffers";
import { WebGLDisposable } from "./Disposable";

export class EdgeLUT implements WebGLDisposable {
  public readonly texture: TextureHandle;
  // ###TODO partition info

  private constructor(texture: TextureHandle) {
    this.texture = texture;
  }

  public dispose(): void {
    dispose(this.texture);
  }

  public static create(table: EdgeTable): EdgeLUT | undefined {
    const texture = TextureHandle.createForData(table.width, table.height, table.data);
    return texture ? new EdgeLUT(texture) : undefined;
  }

  public get bytesUsed(): number {
    return this.texture.bytesUsed;
  }

  public get isDisposed(): boolean {
    return this.texture.isDisposed;
  }
}

// export class IndexedEdgeGeometry extends MeshGeometry {
//   private readonly _vertexTableBuffers: BuffersContainer;
//   private readonly _indices: BufferHandle;
// 
//   public get lutBuffers() { return this._buffers; }
// 
//   public static create(mesh: MeshData, params:
