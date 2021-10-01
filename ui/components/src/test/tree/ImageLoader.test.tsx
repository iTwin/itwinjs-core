/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { PropertyRecord } from "@itwin/appui-abstract";
import { TreeImageLoader } from "../../components-react/tree/ImageLoader";

describe("TreeImageLoader", () => {
  const imageLoader = new TreeImageLoader();

  describe("load", () => {
    it("returns correct image", () => {
      const image = imageLoader.load({ id: "test", label: PropertyRecord.fromString("label"), icon: "test-icon" });
      expect(image).is.not.undefined;
      expect(image!.sourceType).to.equal("webfont-icon");
      expect(image!.value).to.equal("test-icon");
    });

    it("returns undefined when node item has no icon", () => {
      const image = imageLoader.load({ id: "test", label: PropertyRecord.fromString("label") });
      expect(image).is.undefined;
    });
  });
});
