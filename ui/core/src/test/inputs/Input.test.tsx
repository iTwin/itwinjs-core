/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Input } from "../../ui-core";

describe("<Input />", () => {
  it("should render", () => {
    mount(<Input />);
  });

  it("renders correctly", () => {
    shallow(<Input />).should.matchSnapshot();
  });
});
