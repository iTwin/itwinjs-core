/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Footer from "../../src/footer/Footer";

describe("<Footer />", () => {
  it("should render", () => {
    mount(<Footer />);
  });

  it("renders correctly", () => {
    shallow(<Footer />).should.matchSnapshot();
  });
});
