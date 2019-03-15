/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ColorDef } from "@bentley/imodeljs-common";
import { DisplayParams } from "@bentley/imodeljs-frontend/lib/rendering";

export class FakeDisplayParams extends DisplayParams {
  public constructor() { super(DisplayParams.Type.Linear, new ColorDef(), new ColorDef()); }
}
