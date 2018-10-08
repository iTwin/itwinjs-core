/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Tools from "../../src/widget/Tools";

describe("<Tools />", () => {
  it("should render", () => {
    mount(<Tools />);
  });

  it("renders correctly", () => {
    shallow(<Tools />).should.matchSnapshot();
  });
});
