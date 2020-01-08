/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Snap } from "../../../ui-ninezone";

describe("<Snap />", () => {
  it("should render", () => {
    mount(<Snap />);
  });

  it("renders correctly", () => {
    shallow(<Snap />).should.matchSnapshot();
  });

  it("renders active correctly", () => {
    shallow(<Snap isActive />).should.matchSnapshot();
  });

  it("renders correctly with icon", () => {
    shallow(<Snap icon={<i />} />).should.matchSnapshot();
  });
});
