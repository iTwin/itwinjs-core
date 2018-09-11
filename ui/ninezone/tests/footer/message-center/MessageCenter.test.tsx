/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import MessageCenter from "../../../src/footer/message-center/MessageCenter";

describe("<MessageCenter />", () => {
  it("should render", () => {
    mount(<MessageCenter />);
  });

  it("renders correctly", () => {
    shallow(<MessageCenter />).should.matchSnapshot();
  });
});
