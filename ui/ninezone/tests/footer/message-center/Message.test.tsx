/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Message from "@src/footer/message-center/Message";

describe("<Message />", () => {
  it("should render", () => {
    mount(<Message />);
  });

  it("renders correctly", () => {
    shallow(<Message />).should.matchSnapshot();
  });
});
