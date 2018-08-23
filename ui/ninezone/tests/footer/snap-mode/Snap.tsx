/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Snap from "../../../src/footer/snap-mode/Snap";

describe("<Snap />", () => {
  it("should render", () => {
    mount(<Snap />);
  });

  it("renders correctly", () => {
    shallow(<Snap />).should.matchSnapshot();
  });
});
