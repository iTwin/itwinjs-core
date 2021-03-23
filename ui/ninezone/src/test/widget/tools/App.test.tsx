/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { AppButton } from "../../../ui-ninezone.js";
import { mount } from "../../Utils.js";

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
