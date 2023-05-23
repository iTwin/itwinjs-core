/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ColorDef } from "@itwin/core-common";
import { DisplayParams } from "@itwin/core-frontend";

export class FakeDisplayParams extends DisplayParams {
  public constructor() {
    super(DisplayParams.Type.Linear, ColorDef.black, ColorDef.black);
  }
}
