/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import TestUtils from "../TestUtils";
import { SeparatorBackstageItem } from "../../ui-framework/backstage/Separator";

describe("Backstage", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
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
