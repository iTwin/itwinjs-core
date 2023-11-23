/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings } from "@itwin/core-common";
import * as chai from "chai";
import {
  TileUrlImageryProvider,
} from "../../../tile/internal";

describe("TileUrlImageryProvider", () => {
  it("construct proper tile url", async () => {
    const settings = ImageMapLayerSettings.fromJSON({formatId:"TileUrl", name: "", url: "https://sub.service.com/service/{level}/{column}/{row}"});
    let provider = new TileUrlImageryProvider(settings);
    let url = await provider.constructUrl(0,0,0);
    let refUrl = `https://sub.service.com/service/0/0/0`;
    chai.expect(url).to.equals(refUrl);

    const param = new URLSearchParams([["key1", "value1"], ["key2", "value2"]]);
    const paramArray = Array.from(param.entries());
    settings.customParameters = paramArray.map((item) => {
      return {key: item[0], value: item[1]};
    });
    provider = new TileUrlImageryProvider(settings);
    url = await provider.constructUrl(0,0,0);
    chai.expect(url).to.equals(`${refUrl}?${param.toString()}`);

    const settings2 = settings.clone({url: "https://sub.service.com/service/{level}/{column}/{row}?test=1"});
    settings2.customParameters = settings.customParameters;
    provider = new TileUrlImageryProvider(settings2);
    refUrl = `${refUrl}?test=1`;
    url = await provider.constructUrl(0,0,0);
    chai.expect(url).to.equals(`${refUrl}&${param.toString()}`);
  });
});
