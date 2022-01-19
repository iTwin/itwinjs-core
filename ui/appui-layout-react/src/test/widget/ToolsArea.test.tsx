/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { ToolsArea } from "../../appui-layout-react";
import { mount } from "../Utils";

describe("<ToolsArea />", () => {
  it("should render", () => {
    mount(<ToolsArea />);
  });

  it("renders correctly without app button", () => {
    shallow(<ToolsArea />).should.matchSnapshot();
  });

  it("renders correctly with app button", () => {
    shallow(<ToolsArea button={<button />} />).should.matchSnapshot();
  });

  it("renders correctly with vertical toolbar", () => {
    shallow(<ToolsArea verticalToolbar={<div></div>} />).should.matchSnapshot();
  });

  it("renders correctly with horizontal toolbar", () => {
    shallow(<ToolsArea horizontalToolbar={<div></div>} />).should.matchSnapshot();
  });

  it("renders correctly with vertical and horizontal toolbar", () => {
    shallow(<ToolsArea button={<button />} horizontalToolbar={<div></div>} verticalToolbar={<div></div>} />).should.matchSnapshot();
  });
});
