/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Button from "@src/buttons/Button";

describe("<Button />", () => {
  it("should render", () => {
    mount(<Button />);
  });

  it("renders correctly", () => {
    shallow(<Button />).should.matchSnapshot();
  });
});
