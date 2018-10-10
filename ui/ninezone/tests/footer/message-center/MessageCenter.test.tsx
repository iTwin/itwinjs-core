/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
