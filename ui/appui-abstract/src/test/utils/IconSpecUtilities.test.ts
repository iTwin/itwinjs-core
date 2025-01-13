/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IconSpecUtilities } from "../../appui-abstract/utils/IconSpecUtilities";

describe("IconSpecUtilities", () => {

  it("should correctly create iconSpec for WebSvg", () => {
    const iconSpec = IconSpecUtilities.createWebComponentIconSpec("test");
    expect(iconSpec).to.eq(`${IconSpecUtilities.WEB_COMPONENT_PREFIX}test`);
  });

  it("should correctly return WebSvg source from iconSpec", () => {
    const webSvgSource = IconSpecUtilities.getWebComponentSource(`${IconSpecUtilities.WEB_COMPONENT_PREFIX}test`);
    expect(webSvgSource).to.eq("test");
  });

  it("should return undefined if given invalid iconSpec", () => {
    const webSvgSource = IconSpecUtilities.getWebComponentSource("");
    expect(webSvgSource).to.be.undefined;
  });
});
