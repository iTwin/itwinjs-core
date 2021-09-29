/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { MergeTarget } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<MergeTarget />", () => {
  it("should render", () => {
    mount(<MergeTarget />);
  });

  it("renders correctly", () => {
    shallow(<MergeTarget />).should.matchSnapshot();
  });
});
