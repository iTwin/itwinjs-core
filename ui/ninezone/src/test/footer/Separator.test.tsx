/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { FooterSeparator } from "../../ui-ninezone";
import { mount } from "../Utils";

describe("<FooterSeparator />", () => {
  it("should render", () => {
    mount(<FooterSeparator />);
  });

  it("renders correctly", () => {
    shallow(<FooterSeparator />).should.matchSnapshot();
  });
});
