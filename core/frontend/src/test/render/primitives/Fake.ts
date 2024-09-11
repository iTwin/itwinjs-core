/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ColorDef } from "@itwin/core-common";
import { Range3d, Transform } from "@itwin/core-geometry";
import { DisplayParams } from "../../../common/internal/render/DisplayParams";
import { Geometry } from "../../../common/internal/render/GeometryPrimitives";

export class FakeDisplayParams extends DisplayParams {
  public constructor() {
    super(DisplayParams.Type.Linear, ColorDef.black, ColorDef.black);
  }
}

export class FakeGeometry extends Geometry {
  public constructor() {
    super(Transform.createIdentity(), Range3d.createNull(), new FakeDisplayParams(), undefined);
  }

  protected _getPolyfaces() {
    return undefined;
  }

  protected _getStrokes() {
    return undefined;
  }
}
