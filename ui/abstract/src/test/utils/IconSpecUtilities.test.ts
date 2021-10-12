/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IconSpecUtilities } from "../../appui-abstract/utils/IconSpecUtilities";

describe("IconSpecUtilities", () => {

  it("should correctly create iconSpec for svg", () => {
    const iconSpec = IconSpecUtilities.createSvgIconSpec("test");
    expect(iconSpec).to.eq(`${IconSpecUtilities.SVG_PREFIX}test`);
  });

  it("should correctly return svg source from iconSpec", () => {
    const svgSource = IconSpecUtilities.getSvgSource(`${IconSpecUtilities.SVG_PREFIX}test`);
    expect(svgSource).to.eq("test");
  });

  it("should return undefined if given invalid iconSpec", () => {
    const svgSource = IconSpecUtilities.getSvgSource("");
    expect(svgSource).to.be.undefined;
  });

});
