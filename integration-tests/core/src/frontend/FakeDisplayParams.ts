/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ColorDef } from "@bentley/imodeljs-common";
import { DisplayParams } from "@bentley/imodeljs-frontend/lib/rendering";

export class FakeDisplayParams extends DisplayParams {
  public constructor() { super(DisplayParams.Type.Linear, new ColorDef(), new ColorDef()); }
}
