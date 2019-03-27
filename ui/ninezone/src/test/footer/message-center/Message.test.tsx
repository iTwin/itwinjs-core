/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { MessageCenterMessage } from "../../../ui-ninezone";

describe("<MessageCenterMessage />", () => {
  it("should render", () => {
    mount(<MessageCenterMessage />);
  });

  it("renders correctly", () => {
    shallow(<MessageCenterMessage />).should.matchSnapshot();
  });

  it("renders correctly with icon and content", () => {
    shallow(<MessageCenterMessage
      icon={<img></img>}
      content={"Custom message"}
    />).should.matchSnapshot();
  });
});
