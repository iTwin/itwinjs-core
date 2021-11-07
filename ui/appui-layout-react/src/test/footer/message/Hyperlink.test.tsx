/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { MessageHyperlink } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<MessageHyperlink />", () => {
  it("should render", () => {
    mount(<MessageHyperlink />);
  });

  it("renders correctly", () => {
    shallow(<MessageHyperlink />).should.matchSnapshot();
  });
});
