/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { SeparatorBackstageItem } from "../../ui-framework/backstage/Separator.js";
import TestUtils, { mount } from "../TestUtils.js";

describe("Backstage", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("<SeparatorBackstageItem />", () => {
    it("SeparatorBackstageItem should render", () => {
      mount(<SeparatorBackstageItem />);
    });

    it("SeparatorBackstageItem renders correctly", () => {
      shallow(<SeparatorBackstageItem />).should.matchSnapshot();
    });
  });
});
