/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Tab from "@src/footer/message-center/Tab";

describe("<Tab />", () => {
  it("should render", () => {
    mount(<Tab />);
  });

  it("renders correctly", () => {
    shallow(<Tab />).should.matchSnapshot();
  });
});
