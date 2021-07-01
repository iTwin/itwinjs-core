/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ColorDef } from "@bentley/imodeljs-common";
import { Range3d, Transform } from "@bentley/geometry-core";
import { DisplayParams } from "../../../render/primitives/DisplayParams";
import { Geometry } from "../../../render/primitives/geometry/GeometryPrimitives";

export class FakeDisplayParams extends DisplayParams {
  public constructor() {
    super(DisplayParams.Type.Linear, ColorDef.black, ColorDef.black);
  }
}

export class FakeGeometry extends Geometry {
  public constructor() {
    super(Transform.createIdentity(), Range3d.createNull(), new FakeDisplayParams());
  }

  protected _getPolyfaces() {
    return undefined;
  }

  protected _getStrokes() {
    return undefined;
  }
}
