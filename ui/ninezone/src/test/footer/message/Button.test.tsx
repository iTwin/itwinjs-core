/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { MessageButton } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<MessageButton />", () => {
  it("should render", () => {
    mount(<MessageButton />);
  });

  it("renders correctly", () => {
    shallow(<MessageButton />).should.matchSnapshot();
  });
});
