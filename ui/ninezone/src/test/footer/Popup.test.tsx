/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { FooterPopup } from "../../ui-ninezone";

describe("<FooterPopup />", () => {
  it("should render", () => {
    mount(<FooterPopup />);
  });

  it("renders correctly", () => {
    shallow(<FooterPopup />).should.matchSnapshot();
  });
});
