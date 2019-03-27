/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Footer } from "../../ui-ninezone";

describe("<Footer />", () => {
  it("should render", () => {
    mount(<Footer />);
  });

  it("renders correctly", () => {
    shallow(<Footer />).should.matchSnapshot();
  });

  it("renders correctly in widget mode", () => {
    shallow(<Footer isInWidgetMode />).should.matchSnapshot();
  });
});
