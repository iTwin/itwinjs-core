/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Content from "@src/footer/message-center/Content";

describe("<Content />", () => {
  it("should render", () => {
    mount(<Content />);
  });

  it("renders correctly", () => {
    shallow(<Content />).should.matchSnapshot();
  });
});
