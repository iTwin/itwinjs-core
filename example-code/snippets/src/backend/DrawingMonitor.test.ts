/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { StandaloneDb } from "@itwin/core-backend";
import { IModelTestUtils } from "./IModelTestUtils";
import { expect } from "chai";

describe.only("DrawingMonitor", () => {
  let db: StandaloneDb;

  before(async () => {
    db = IModelTestUtils.openIModelForWrite("test.bim", { copyFilename: "DrawingMonitor.bim", upgradeStandaloneSchemas: true });
    let bisVer = db.querySchemaVersionNumbers("BisCore")!;
    expect(bisVer.read).to.equal(1);
    expect(bisVer.write).to.equal(0);
    expect(bisVer.minor).least(22);
  });

  after(() => db.close());

  it("test", () => {

  });
});
