/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Arc3d, Point3d } from "@itwin/core-geometry";
import type { GeometryStreamProps } from "@itwin/core-common";
import { GeometryStreamBuilder } from "@itwin/core-common";

// __PUBLISH_EXTRACT_START__ GeometryStreamBuilder.example-code
// Simple example of using GeometryStreamBuilder. Note how the building works with
// geometry primitive types such as Arc3d.
export function generateGeometry(radius: number = 0.1): GeometryStreamProps {
  const builder = new GeometryStreamBuilder();
  const circle = Arc3d.createXY(Point3d.createZero(), radius);
  builder.appendGeometry(circle);
  return builder.geometryStream;
}
// __PUBLISH_EXTRACT_END__
