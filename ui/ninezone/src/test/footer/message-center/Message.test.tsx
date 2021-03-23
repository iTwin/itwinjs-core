/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { MessageCenterMessage } from "../../../ui-ninezone.js";
import { mount } from "../../Utils.js";

describe("<MessageCenterMessage />", () => {
  it("should render", () => {
    mount(<MessageCenterMessage />);
  });

  it("renders correctly", () => {
    shallow(<MessageCenterMessage />).should.matchSnapshot();
  });

  it("renders correctly with icon and content", () => {
    shallow(
      <MessageCenterMessage icon={<img alt=""></img>}>
        Custom message
      </MessageCenterMessage>,
    ).should.matchSnapshot();
  });
});
