/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import type { Id64Set, Id64String } from "@itwin/core-bentley";
import type { ElementProps} from "@itwin/core-common";
import { QueryRowFormat } from "@itwin/core-common";
import type { IModelConnection} from "@itwin/core-frontend";
import { SpatialModelState } from "@itwin/core-frontend";
import { TestContext } from "./setup/TestContext";

const expect = chai.expect;

describe("IModel Elements", () => {
  let iModel: IModelConnection;
  let elements: IModelConnection.Elements;

  before(async function () {
    const testContext = await TestContext.instance();

    if (!testContext.settings.runiModelReadRpcTests)
      this.skip();

    iModel = await testContext.iModelWithChangesets!.getConnection();
    elements = iModel.elements;
  });

  it("should get props", async () => {
    const elementIds: Id64String[] = [elements.rootSubjectId];
    const elementProps: ElementProps[] = await elements.getProps(elementIds);

    expect(elementProps).to.exist.and.be.not.empty;
  });

  it("should query props", async () => {
    const elementProps: ElementProps[] = await elements.queryProps({ from: SpatialModelState.classFullName });

    expect(elementProps).to.exist.and.be.not.empty;
  });

  it("should query ids", async () => {
    const ids: Id64Set = await elements.queryIds({ limit: 10, from: "BisCore:Subject" });

    expect(ids).to.exist;
  });
});

describe("Operational: Execute Query", () => {
  it("should successfully execute a simple query", async function () {
    const testContext = await TestContext.instance();

    if (!testContext.settings.runiModelReadRpcTests)
      this.skip();

    const iModel = await testContext.iModelWithChangesets!.getConnection();
    const query = "select count(*) nRows from(SELECT ECInstanceId FROM Bis.Element LIMIT 50)";

    const rows = [];
    for await (const row of iModel.query(query, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }))
      rows.push(row);

    expect(rows).to.be.not.empty;
  });
});

