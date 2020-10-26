/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { MessageCenterDialog } from "../../../ui-ninezone";
import { mount } from "../../Utils";

describe("<MessageCenterDialog />", () => {
  it("should render", () => {
    mount(<MessageCenterDialog />);
  });

  it("renders correctly", () => {
    shallow(<MessageCenterDialog />).should.matchSnapshot();
  });
});
