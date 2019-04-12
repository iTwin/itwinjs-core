/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { TitleBar } from "../../../ui-ninezone";

describe("<TitleBar />", () => {
  it("should render", () => {
    mount(<TitleBar />);
  });

  it("renders correctly", () => {
    shallow(<TitleBar />).should.matchSnapshot();
  });
});
