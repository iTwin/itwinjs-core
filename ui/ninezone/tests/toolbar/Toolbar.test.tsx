/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Toolbar from "@src/toolbar/Toolbar";
import { Direction } from "@src/utilities/Direction";

describe("<Toolbar />", () => {
  it("should render", () => {
    mount(<Toolbar />);
  });

  it("renders correctly", () => {
    shallow(<Toolbar />).should.matchSnapshot();
  });

  it("renders vertical with expands to direction", () => {
    shallow(<Toolbar expandsTo={Direction.Left}/>).should.matchSnapshot();
  });
});
