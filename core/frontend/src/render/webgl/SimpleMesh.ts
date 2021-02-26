/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { dispose } from "@bentley/bentleyjs-core";
import { AttributeMap, BufferHandle, BufferParameters, IndexedGeometryParams, QBufferHandle2d, QBufferHandle3d, TechniqueId } from "../../webgl";
import { GL } from "./GL";
import assert = require("assert");
import { SimpleMeshPrimitive } from "../primitives/mesh/SimpleMeshPrimitive";

/** @internal */

export class SimpleMeshGeometryParams extends IndexedGeometryParams {
  public readonly uvParams: QBufferHandle2d;
  public readonly featureID?: number;
  public readonly normals?: BufferHandle;

  protected constructor(positions: QBufferHandle3d, normals: BufferHandle | undefined, uvParams: QBufferHandle2d, indices: BufferHandle, numIndices: number, featureID?: number) {
    super(positions, indices, numIndices);
    let attrParams = AttributeMap.findAttribute("a_uvParam", TechniqueId.TerrainMesh, false);
    assert(attrParams !== undefined);
    this.buffers.addBuffer(uvParams, [BufferParameters.create(attrParams!.location, 2, GL.DataType.UnsignedShort, false, 0, 0, false)]);
    this.uvParams = uvParams;

    if (undefined !== normals) {
      attrParams = AttributeMap.findAttribute("a_norm", TechniqueId.TerrainMesh, false);
      assert(attrParams !== undefined);
      if (normals.bytesUsed > 0)
        this.buffers.addBuffer(normals, [BufferParameters.create(attrParams!.location, 2, GL.DataType.UnsignedByte, false, 0, 0, false)]);
      this.normals = normals;
    }

    this.featureID = featureID;
  }

  public static createFromPrimitive(mesh: SimpleMeshPrimitive) {
    const posBuf = QBufferHandle3d.create(mesh.points.params, mesh.points.toTypedArray());
    const uvParamBuf = QBufferHandle2d.create(mesh.uvParams.params, mesh.uvParams.toTypedArray());

    const indArray = new Uint16Array(mesh.indices.length);
    for (let i = 0; i < mesh.indices.length; i++)
      indArray[i] = mesh.indices[i];

    const indBuf = BufferHandle.createBuffer(GL.Buffer.Target.ElementArrayBuffer, indArray);

    let normBuf: BufferHandle | undefined;
    if (mesh.normals.length > 0) {
      const normalBytes = new Uint8Array(mesh.normals.length * 2);
      const normalShorts = new Uint16Array(normalBytes.buffer);
      for (let i = 0; i < mesh.normals.length; i++)
        normalShorts[i] = mesh.normals[i].value;
      normBuf = BufferHandle.createArrayBuffer(normalBytes);
    }

    if (undefined === posBuf || undefined === uvParamBuf || undefined === indBuf || (mesh.normals.length > 0 && undefined === normBuf))
      return undefined;

    return new SimpleMeshGeometryParams(posBuf, normBuf, uvParamBuf, indBuf, mesh.indices.length, mesh.featureID);
  }
  public get isDisposed(): boolean {
    return super.isDisposed && this.uvParams.isDisposed;
  }
  public get bytesUsed(): number { return this.positions.bytesUsed + (undefined === this.normals ? 0 : this.normals.bytesUsed) + this.uvParams.bytesUsed + this.indices.bytesUsed; }

  public dispose() {
    super.dispose();
    dispose(this.uvParams);
  }
}
