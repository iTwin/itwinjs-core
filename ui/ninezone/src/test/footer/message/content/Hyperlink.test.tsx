/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Hyperlink } from "../../../../ui-ninezone";

describe("<Hyperlink />", () => {
  it("should render", () => {
    mount(<Hyperlink />);
  });

  it("renders correctly", () => {
    shallow(<Hyperlink />).should.matchSnapshot();
  });
});
