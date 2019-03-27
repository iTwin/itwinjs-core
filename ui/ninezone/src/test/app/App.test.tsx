/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { App } from "../../ui-ninezone";

describe("<App />", () => {
  it("should render", () => {
    mount(<App />);
  });

  it("renders correctly", () => {
    shallow(<App />).should.matchSnapshot();
  });
});
