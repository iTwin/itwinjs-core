/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { SheetNavigationAid } from "../../../src/index";
import TestUtils from "../../TestUtils";

describe("SheetNavigationAid", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("<SheetNavigationAid />", () => {
    it("should render", () => {
      mount(<SheetNavigationAid />);
    });
    it("renders correctly", () => {
      shallow(<SheetNavigationAid />).should.matchSnapshot();
    });
  });
});
