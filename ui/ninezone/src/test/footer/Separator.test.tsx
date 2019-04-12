/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { FooterSeparator } from "../../ui-ninezone";

describe("<FooterSeparator />", () => {
  it("should render", () => {
    mount(<FooterSeparator />);
  });

  it("renders correctly", () => {
    shallow(<FooterSeparator />).should.matchSnapshot();
  });
});
