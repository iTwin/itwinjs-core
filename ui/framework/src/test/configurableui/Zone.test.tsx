/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import TestUtils from "../TestUtils";
import { Zone } from "../../ui-framework";

describe("Zone", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render", () => {
    mount(<Zone />);
  });

  it("renders correctly", () => {
    shallow(<Zone />).should.matchSnapshot();
  });

});
