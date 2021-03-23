/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { TabSeparator } from "../../../../ui-ninezone.js";
import { mount } from "../../../Utils.js";

describe("<TabSeparator />", () => {
  it("should render", () => {
    mount(<TabSeparator />);
  });

  it("renders correctly", () => {
    shallow(<TabSeparator />).should.matchSnapshot();
  });

  it("renders horizontal correctly", () => {
    shallow(<TabSeparator isHorizontal />).should.matchSnapshot();
  });
});
