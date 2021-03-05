/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Guid } from "@bentley/bentleyjs-core";
import { Range3d } from "@bentley/geometry-core";
import { Cartographic } from "@bentley/imodeljs-common";
import { BlankConnection, IModelConnection } from "../IModelConnection";

/** Open a blank connection for tests. */
export function createBlankConnection(name = "test-blank-connection",
  location = Cartographic.fromDegrees(-75.686694, 40.065757, 0),
  extents = new Range3d(-1000, -1000, -100, 1000, 1000, 100),
  contextId = Guid.createValue()): IModelConnection {
  return BlankConnection.create({ name, location, extents, contextId });
}
