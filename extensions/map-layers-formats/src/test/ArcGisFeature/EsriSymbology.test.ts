/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import { NeptuneCoastlineDataset } from "./NeptuneCoastlineDataset";
import * as chai from "chai";
import { EsriUniqueValueRenderer } from "../../ArcGisFeature/EsriSymbology";
const expect = chai.expect;

describe("EsriSymbology", () => {

  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should construct EsriUniqueValueRenderer", async () => {
    const dataset = NeptuneCoastlineDataset.uniqueValueSFSDrawingInfo;
    const renderer = EsriUniqueValueRenderer.fromJSON(dataset.drawingInfo.renderer as any);
    expect(renderer.field1).equals(dataset.drawingInfo.renderer.field1);
    expect(renderer.field2).to.be.undefined;
    expect(renderer.field3).to.be.undefined;
    expect(renderer.type).equals(dataset.drawingInfo.renderer.type);
    expect(renderer.uniqueValueInfos.length).equals(dataset.drawingInfo.renderer.uniqueValueInfos.length);
    for (let i = 0 ; i < renderer.uniqueValueInfos.length; i++) {
      const lhs = renderer.uniqueValueInfos[i];
      const rhs = dataset.drawingInfo.renderer.uniqueValueInfos[i];
      expect(lhs.value).equals(rhs.value);
      expect(lhs.label).equals(rhs.label);
      expect(lhs.description).equals(rhs.description);
      expect(lhs.symbol.type).equals(rhs.symbol.type);
    }
  });

}); // end test suite
