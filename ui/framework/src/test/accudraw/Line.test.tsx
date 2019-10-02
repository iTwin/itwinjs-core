/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Line } from "../../ui-framework/accudraw/Line";

describe("Line", () => {
  it("should render", () => {
    mount(<Line start={{ x: 50, y: 150 }} end={{ x: 100, y: 150 }} />);
  });

  it("renders correctly", () => {
    shallow(<Line start={{ x: 50, y: 150 }} end={{ x: 100, y: 150 }} />).should.matchSnapshot();
  });
});
