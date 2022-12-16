/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Range3d } from "@itwin/core-geometry";
import { RealityMeshParamsBuilder } from "../../render/RealityMeshParams";

describe.only("RealityMeshParamsBuilder", () => {
  it("supports 8-bit indices", () => {
  });

  it("supports 16-bit indices", () => {
  });

  it("supports 32-bit indices", () => {
  });

  it("defines initial index buffer type based on number of initial vertices", () => {
    function expectIndices(initialVertexCapacity: number, expectedType: typeof Uint8Array | typeof Uint16Array | typeof Uint32Array): void {
      const builder = new RealityMeshParamsBuilder({
        positionRange: Range3d.createNull(),
        initialVertexCapacity,
      });

      expect(builder.finish().indices).instanceof(expectedType);
    }

    expectIndices(0, Uint8Array);
    expectIndices(255, Uint8Array);
    expectIndices(256, Uint16Array);
    expectIndices(65535, Uint16Array);
    expectIndices(65536, Uint32Array);
    expectIndices(12345678, Uint32Array);
  });
});
