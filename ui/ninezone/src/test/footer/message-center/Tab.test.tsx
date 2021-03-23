/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { MessageCenterTab } from "../../../ui-ninezone.js";
import { mount } from "../../Utils.js";

describe("<MessageCenterTab />", () => {
  it("should render", () => {
    mount(<MessageCenterTab />);
  });

  it("renders correctly", () => {
    shallow(<MessageCenterTab />).should.matchSnapshot();
  });

  it("renders active correctly", () => {
    shallow(<MessageCenterTab isActive />).should.matchSnapshot();
  });
});
