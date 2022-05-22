/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { MessageCenterMessage } from "../../../appui-layout-react";
import { mount } from "../../Utils";

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
