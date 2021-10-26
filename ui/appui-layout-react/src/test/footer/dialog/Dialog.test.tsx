/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { Dialog } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<Dialog />", () => {
  it("should render", () => {
    mount(<Dialog />);
  });

  it("renders correctly", () => {
    shallow(<Dialog />).should.matchSnapshot();
  });
});
