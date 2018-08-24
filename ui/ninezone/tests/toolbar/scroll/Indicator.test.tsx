/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Indicator from "../../../src/toolbar/scroll/Indicator";
import { Direction } from "../../../src/utilities/Direction";

describe("<Indicator />", () => {
  it("should render", () => {
    mount(<Indicator direction={Direction.Left} />);
  });

  it("renders correctly", () => {
    shallow(<Indicator direction={Direction.Left} />).should.matchSnapshot();
  });
});
