/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { ExpandableList } from "../../src/index";
import TestUtils from "../TestUtils";

describe("ExpandableList", () => {

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  describe("<ExpandableList />", () => {
    it("should render", () => {
      mount(<ExpandableList />);
    });

    it("renders correctly", () => {
      shallow(<ExpandableList />).should.matchSnapshot();
    });
  });
});
