/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Chevron from "@src/toolbar/scroll/Chevron";
import { Direction } from "@src/utilities/Direction";

describe("<Chevron />", () => {
  it("should render", () => {
    mount(<Chevron direction={Direction.Left} />);
  });

  it("renders correctly", () => {
    shallow(<Chevron direction={Direction.Left} />).should.matchSnapshot();
  });
});
