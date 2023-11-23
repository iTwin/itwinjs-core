/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings } from "@itwin/core-common";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import {
  ArcGISImageryProvider,

} from "../../../tile/internal";

chai.use(chaiAsPromised);

const sampleSource = { formatId: "ArcGIS", url: "https://sub.service.com/service", name: "Test" };

class TestArcGISProvider extends  ArcGISImageryProvider {
  public override async  constructUrl(_row: number, _column: number, _zoomLevel: number): Promise<string> {
    return "";
  }

  public override async fetch(url: URL, options?: RequestInit): Promise<Response> {
    return super.fetch(url, options);
  }
}

describe("ArcGISImageryProvider", () => {
  const sandbox = sinon.createSandbox();
  afterEach(async () => {
    sandbox.restore();
  });
  it("should inject custom parameters before fetch call", async () => {
    const settings = ImageMapLayerSettings.fromJSON({...sampleSource, subLayers: [{name:"layer1", id: "1", visible:false}, {name:"layer2", id: "2", visible:true}, {name:"layer3", id: "3", visible:true}]});
    if (!settings)
      chai.assert.fail("Could not create settings");

    const provider = new TestArcGISProvider(settings, true);

    const fetchStub = sandbox.stub(global, "fetch").callsFake(async function (_input: RequestInfo | URL, _init?: RequestInit) {

      return Promise.resolve((({
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => {},
      } as unknown) as Response));
    });

    const testUrl = `${settings.url }?testParam=test`;
    await provider.fetch(new URL(testUrl), { method: "GET" });
    chai.expect(fetchStub.called).to.be.true;
    chai.expect(fetchStub.getCall(0).args[0]).to.equals(testUrl);

    const param = new URLSearchParams([["key1", "value1"], ["key2", "value2"], ["testParam", "BAD"]]);
    const paramArray = Array.from(param.entries());
    settings.customParameters = paramArray.map((item) => {
      return {key: item[0], value: item[1]};
    });
    param.delete("testParam");    // test should not be updated since its already part of the initial url
    await provider.fetch(new URL(testUrl), { method: "GET" });
    chai.expect(fetchStub.called).to.be.true;
    chai.expect(fetchStub.getCall(1).args[0]).to.equals(`${testUrl}&${param.toString()}`);
  });

});
