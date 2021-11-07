/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { TitleBarButton } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<TitleBarButton />", () => {
  it("should render", () => {
    mount(<TitleBarButton />);
  });

  it("renders correctly", () => {
    shallow(<TitleBarButton />).should.matchSnapshot();
  });
});
