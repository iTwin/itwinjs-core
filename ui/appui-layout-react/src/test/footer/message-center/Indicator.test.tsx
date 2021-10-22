/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { MessageCenter } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<MessageCenter />", () => {
  it("should render", () => {
    mount(<MessageCenter />);
  });

  it("renders correctly", () => {
    shallow(<MessageCenter />).should.matchSnapshot();
  });

  it("renders correctly with label", () => {
    shallow(<MessageCenter label="Messages:" />).should.matchSnapshot();
  });
});
