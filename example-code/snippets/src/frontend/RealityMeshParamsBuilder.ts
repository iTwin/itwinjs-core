/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Range3d } from "@itwin/core-geometry";
import { RealityMeshParams, RealityMeshParamsBuilder } from "@itwin/core-frontend";

// __PUBLISH_EXTRACT_START__ Build_Reality_Mesh_Params
export function buildRealityMeshParams(): RealityMeshParams {
  // Create the builder.
  const builder = new RealityMeshParamsBuilder({
    // Our mesh contains 4 vertices.
    initialVertexCapacity: 4,
    // Our mesh contains 2 triangles with 3 indices each.
    initialIndexCapacity: 6,
    // Our meshes positions all fall within [(0,0,0), (10,5,0)].
    positionRange: new Range3d(0, 0, 0, 10, 5, 0),
  });

  // Add the 4 corners of the rectangle.
  builder.addVertex({x:0, y:0, z:0}, {x:0, y:0});
  builder.addVertex({x:10, y:0, z:0}, {x:1, y:0});
  builder.addVertex({x:10, y:5, z:0}, {x:1, y:1});
  builder.addVertex({x:0, y:5, z:0}, {x:0, y:1});

  // Add the two triangles describing the rectangle.
  builder.addTriangle(0, 1, 2);
  builder.addTriangle(0, 2, 3);

  // Extract the RealityMeshParams.
  return builder.finish();
}
// __PUBLISH_EXTRACT_END__
