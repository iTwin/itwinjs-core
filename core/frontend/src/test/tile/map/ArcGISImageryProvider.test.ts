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
import { indexedArrayFromUrlParams } from "./MapLayerTestUtilities";
import { headersIncludeAuthMethod } from "../../../request/utils";

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

    let urlObj = fetchStub.getCall(0).args[0];
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    chai.expect(urlObj.toString()).to.equals(testUrl);

    const unsaved = new URLSearchParams([["key1_1", "value1_1"], ["key1_2", "value1_2"], ["testParam", "BAD"]]);
    const saved = new URLSearchParams([["key2_1", "value2_1"], ["key2_2", "value2_2"] ]);
    settings.unsavedQueryParams = indexedArrayFromUrlParams(unsaved);
    settings.savedQueryParams = indexedArrayFromUrlParams(saved);

    unsaved.delete("testParam");    // check that test'
    await provider.fetch(new URL(testUrl), { method: "GET" });
    chai.expect(fetchStub.called).to.be.true;
    urlObj = fetchStub.getCall(1).args[0];
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    chai.expect(urlObj.toString()).to.equals(`${testUrl}&${saved.toString()}&${unsaved.toString()}`);
  });

  it("headersIncludeAuthMethod", async () => {
    const headers1 = new Headers([["WWW-authenticate", "ntlm"]]);
    chai.expect(headersIncludeAuthMethod(headers1, ["ntlm", "negotiate"])).to.be.true;
    const headers2 = new Headers([["www-authenticate", "ntlm"]]);
    chai.expect(headersIncludeAuthMethod(headers2, ["ntlm", "negotiate"])).to.be.true;
  });

});
