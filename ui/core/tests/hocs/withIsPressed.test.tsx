/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { withIsPressed, Div } from "../../src/index";

describe("withIsPressed", () => {

  const WithIsPressedDiv = withIsPressed(Div); // tslint:disable-line:variable-name

  it("should render", () => {
    mount(<WithIsPressedDiv isPressed={false} />);
  });

  it("renders correctly", () => {
    shallow(<WithIsPressedDiv isPressed={false} />).should.matchSnapshot();
  });

});
