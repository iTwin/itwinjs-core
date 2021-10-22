/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { NavigationArea } from "../../appui-layout-react";
import { mount } from "../Utils";

describe("<NavigationArea />", () => {
  it("should render", () => {
    mount(<NavigationArea />);
  });

  it("renders correctly without app button", () => {
    shallow(<NavigationArea />).should.matchSnapshot();
  });

  it("renders correctly with navigation aid", () => {
    shallow(<NavigationArea navigationAid={<div></div>} />).should.matchSnapshot();
  });

  it("renders correctly with vertical toolbar", () => {
    shallow(<NavigationArea verticalToolbar={<div></div>} />).should.matchSnapshot();
  });

  it("renders correctly with horizontal toolbar", () => {
    shallow(<NavigationArea horizontalToolbar={<div></div>} />).should.matchSnapshot();
  });

  it("renders correctly with vertical and horizontal toolbar", () => {
    shallow(<NavigationArea navigationAid={<div></div>} horizontalToolbar={<div></div>} verticalToolbar={<div></div>} />).should.matchSnapshot();
  });
});
