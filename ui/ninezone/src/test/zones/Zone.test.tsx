/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { ZoneComponent } from "../../ui-ninezone";

describe("<ZoneComponent />", () => {
  it("should render", () => {
    mount(<ZoneComponent bounds={{ bottom: 10, left: 0, right: 10, top: 0 }} />);
  });

  it("renders correctly", () => {
    shallow(<ZoneComponent bounds={{ bottom: 10, left: 0, right: 10, top: 0 }} />).should.matchSnapshot();
  });
});
