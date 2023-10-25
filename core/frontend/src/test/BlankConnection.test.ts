/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { createBlankConnection } from "./createBlankConnection";

describe("BlankConnection", async () => {
  before(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  after(async () => IModelApp.shutdown());

  it("preserves name", async () => {
    const name = "my-blank-connection";
    const imodel = createBlankConnection(name);
    expect(imodel.name).to.equal(name);
    await imodel.close();
  });
});
