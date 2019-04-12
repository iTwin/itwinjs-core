/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { MessageHyperlink } from "../../../ui-ninezone";

describe("<MessageHyperlink />", () => {
  it("should render", () => {
    mount(<MessageHyperlink />);
  });

  it("renders correctly", () => {
    shallow(<MessageHyperlink />).should.matchSnapshot();
  });
});
