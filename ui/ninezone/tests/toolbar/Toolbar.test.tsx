/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import Toolbar, { ToolbarPanelAlignment } from "@src/toolbar/Toolbar";
import { Direction } from "@src/utilities/Direction";

describe("<Toolbar />", () => {
  it("should render", () => {
    mount(<Toolbar />);
  });

  it("renders correctly", () => {
    shallow(<Toolbar />).should.matchSnapshot();
  });

  it("renders with expandsTo", () => {
    shallow(<Toolbar expandsTo={Direction.Right} />).should.matchSnapshot();
  });

  it("renders with panelAlignment", () => {
    shallow(<Toolbar panelAlignment={ToolbarPanelAlignment.End} />).should.matchSnapshot();
  });
});
