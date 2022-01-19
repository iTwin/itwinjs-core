/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { AppButton } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<AppButton  />", () => {
  it("should render", () => {
    mount(<AppButton />);
  });

  it("renders correctly", () => {
    shallow(<AppButton />).should.matchSnapshot();
  });

  it("Small AppButton should render", () => {
    mount(<AppButton small />);
  });

  it("Small AppButton renders correctly", () => {
    shallow(<AppButton small />).should.matchSnapshot();
  });
});
