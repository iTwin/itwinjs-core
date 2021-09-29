/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Guid } from "@itwin/core-bentley";
import { Range3d } from "@itwin/core-geometry";
import { Cartographic } from "@itwin/core-common";
import { BlankConnection } from "../IModelConnection";

/** Open a blank connection for tests. */
export function createBlankConnection(name = "test-blank-connection",
  location = Cartographic.fromDegrees({ longitude: -75.686694, latitude: 40.065757, height: 0 }),
  extents = new Range3d(-1000, -1000, -100, 1000, 1000, 100),
  iTwinId = Guid.createValue()): BlankConnection {
  return BlankConnection.create({ name, location, extents, iTwinId });
}
