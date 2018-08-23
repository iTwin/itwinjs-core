/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Tab from "../../../../src/widget/rectangular/tab/Tab";

describe("<Tab />", () => {
  it("should render", () => {
    mount(<Tab />);
  });

  it("renders correctly", () => {
    shallow(<Tab />).should.matchSnapshot();
  });
});
