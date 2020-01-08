/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
const expect = chai.expect;

import { TestContext } from "./setup/TestContext";

describe("Operational: Execute Query", () => {
  it("should successfully execute a simple query", async function () {
    const testContext = await TestContext.instance();

    if (!testContext.settings.runiModelReadRpcTests)
      this.skip();

    const iModel = await testContext.iModelWithChangesets!.getConnection();
    const query = "select count(*) nRows from(SELECT ECInstanceId FROM Bis.Element LIMIT 50)";

    const rows = [];
    for await (const row of iModel.query(query))
      rows.push(row);

    expect(rows).to.be.not.empty;
  });
});
