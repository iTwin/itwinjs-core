/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect} from "chai";
import { IModelTestUtils } from "../IModelTestUtils";

describe.only("FontFile", () => {
  it("wip", () => {
    expect(IModelTestUtils.resolveFontFile("Karla-Regular.ttf", "Karla").length).greaterThan(5);
    expect(IModelTestUtils.resolveFontFile("Cdm.shx").length).greaterThan(5);
  });
});
