/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { FooterSeparator } from "../../ui-ninezone.js";
import { mount } from "../Utils.js";

describe("<FooterSeparator />", () => {
  it("should render", () => {
    mount(<FooterSeparator />);
  });

  it("renders correctly", () => {
    shallow(<FooterSeparator />).should.matchSnapshot();
  });
});
