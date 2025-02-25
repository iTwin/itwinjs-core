/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { Uint8ArrayBuilder } from "@itwin/core-bentley";
import { BentleyGeometryFlatBuffer, IndexedPolyface, Point3d, PolyfaceBuilder } from "@itwin/core-geometry";
import { readElementMeshes } from "../ElementMesh";

class MeshesBuilder extends Uint8ArrayBuilder {
  public appendChunk(type: string, data?: Uint8Array): void {
    for (const c of type)
      this.push(c.charCodeAt(0));

    this.appendU32(data?.length ?? 0);
    if (data)
      this.append(data);
  }

  public appendU32(val: number): void {
    const u32 = new Uint32Array(1);
    u32[0] = val;
    const u8 = new Uint8Array(u32.buffer);
    this.append(u8);
  }

  public appendTriangle(chunkType = "PLFC"): void {
    const builder = PolyfaceBuilder.create();
    builder.addTriangleFacet([new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(1, 0, 0)]);
    const bytes = BentleyGeometryFlatBuffer.geometryToBytes(builder.claimPolyface(), true)!;
    expect(bytes).not.to.be.undefined;
    this.appendChunk(chunkType, bytes);
  }

  public getPolyfaces(): IndexedPolyface[] {
    return readElementMeshes(this.toTypedArray());
  }
}

describe("readElementMeshes", () => {
  it("reads polyfaces", () => {
    const builder = new MeshesBuilder();
    builder.appendChunk("LMSH");
    builder.appendTriangle();

    let meshes = builder.getPolyfaces();
    expect(meshes.length).to.equal(1);

    builder.appendTriangle();
    meshes = builder.getPolyfaces();
    expect(meshes.length).to.equal(2);
  });

  it("requires LMSH chunk", () => {
    const builder = new MeshesBuilder();
    builder.appendTriangle();
    builder.appendTriangle();
    expect(builder.getPolyfaces().length).to.equal(0);
  });

  it("ignores invalid polyfaces", () => {
    const builder = new MeshesBuilder();
    builder.appendChunk("LMSH");
    builder.appendChunk("PLFC", new Uint8Array(8));
    expect(builder.getPolyfaces().length).to.equal(0);

    builder.appendTriangle();
    expect(builder.getPolyfaces().length).to.equal(1);
  });

  it("ignores unrecognized and invalid chunk types", () => {
    const builder = new MeshesBuilder();
    builder.appendChunk("LMSH");
    builder.appendTriangle("BLAH");
    builder.appendTriangle();
    builder.appendTriangle("*_x!");
    expect(builder.getPolyfaces().length).to.equal(1);
  });

  it("ignores trailing non-chunk bytes", () => {
    const builder = new MeshesBuilder();
    builder.appendChunk("LMSH");
    builder.appendTriangle();
    builder.append(new Uint8Array([1, 2, 3, 4, 5]));
    expect(builder.getPolyfaces().length).to.equal(1);
  });

  it("ignores chunks following non-chunk data", () => {
    const builder = new MeshesBuilder();
    builder.appendChunk("LMSH");
    builder.append(new Uint8Array([1, 2, 3, 4, 5]));
    builder.appendTriangle();
    expect(builder.getPolyfaces().length).to.equal(0);
  });
});

