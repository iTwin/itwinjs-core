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

    const param1 = new URLSearchParams([["key1_1", "value1_1"], ["key1_2", "value1_2"]]);
    const param2 = new URLSearchParams([["key2_1", "value2_2"], ["key2_2", "value2_2"]]);
    settings.savedQueryParams = {};
    settings.unsavedQueryParams = {};
    param1.forEach((value: string, key: string) =>  settings.savedQueryParams![key] = value);
    param2.forEach((value: string, key: string) =>  settings.unsavedQueryParams![key] = value);
    provider = new TileUrlImageryProvider(settings);
    url = await provider.constructUrl(0,0,0);
    chai.expect(url).to.equals(`${refUrl}?${param1.toString()}&${param2.toString()}`);

    const settings2 = settings.clone({url: "https://sub.service.com/service/{level}/{column}/{row}?test=1"});
    settings2.savedQueryParams = settings.savedQueryParams;
    settings2.unsavedQueryParams = settings.unsavedQueryParams;
    provider = new TileUrlImageryProvider(settings2);
    refUrl = `${refUrl}?test=1`;
    url = await provider.constructUrl(0,0,0);
    chai.expect(url).to.equals(`${refUrl}&${param1.toString()}&${param2.toString()}`);
  });
});
