/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { CircularHandle } from "../../ui-framework/accudraw/CircularHandle";

describe("CircularHandle", () => {
  it("should render", () => {
    mount(<CircularHandle point={{ x: 100, y: 120 }} size={21} />);
  });

  it("renders correctly", () => {
    shallow(<CircularHandle point={{ x: 100, y: 120 }} size={21} />).should.matchSnapshot();
  });
});
