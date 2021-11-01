/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { BackButton } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<BackButton  />", () => {
  it("should render", () => {
    mount(<BackButton />);
  });

  it("renders correctly", () => {
    shallow(<BackButton />).should.matchSnapshot();
  });
});
