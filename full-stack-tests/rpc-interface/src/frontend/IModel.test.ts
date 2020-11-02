/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { FontMap, GeometryContainmentRequestProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { TestContext } from "./setup/TestContext";

const expect = chai.expect;

describe("IModel Views", () => {

  let iModel: IModelConnection;

  before(async function () {
    const testContext = await TestContext.instance();

    if (!testContext.settings.runiModelReadRpcTests)
      this.skip();

    iModel = await testContext.iModelWithChangesets!.getConnection();
  });

  it("should load font map", async () => {
    const fontMap: FontMap = await iModel.loadFontMap();
    expect(fontMap).to.exist.and.be.not.empty;
  });

  it("should execute test", async () => {
    // IModelReadRpcInterface is configured, expect success
    const viewProps = await iModel.views.queryProps({ from: "BisCore:ViewDefinition" });
    expect(viewProps).to.exist.and.be.not.empty;
    const viewState = await iModel.views.load(viewProps[0].id!);
    expect(viewState).to.exist.and.be.not.empty;

    // IModelUnitTestGateway is intentionally not configured, expect failure
    // expect(iModel.executeTest("rotateCameraLocal", {})).to.be.rejectedWith(IModelError);
  });

  it("should successfully get geometry containment", async () => {
    const requestProps: GeometryContainmentRequestProps = {
      candidates: [],
      clip: {},
    };

    const result = await iModel.getGeometryContainment(requestProps);
    expect(result).to.be.not.be.empty;
  });
});
