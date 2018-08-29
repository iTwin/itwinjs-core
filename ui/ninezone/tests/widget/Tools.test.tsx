/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Tools from "../../src/widget/Tools";

describe("<Tools />", () => {
  it("should render", () => {
    mount(<Tools />);
  });

  it("renders correctly", () => {
    shallow(<Tools />).should.matchSnapshot();
  });
});
