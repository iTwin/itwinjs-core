/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { Direction, Toolbar, ToolbarPanelAlignment, PanelsProvider } from "../../ui-ninezone";

describe("<Toolbar />", () => {
  it("should render", () => {
    mount(<Toolbar />);
  });

  it("renders correctly", () => {
    shallow(<Toolbar />).should.matchSnapshot();
  });

  it("renders with expandsTo", () => {
    const sut = shallow(
      <Toolbar
        expandsTo={Direction.Right}
      />,
    );
    const renderProp = sut.find(PanelsProvider).prop("children");
    const rendered = shallow(renderProp!(undefined) as React.ReactElement<{}>);
    rendered.should.matchSnapshot();
  });

  it("renders with panelAlignment", () => {
    const sut = shallow(
      <Toolbar
        panelAlignment={ToolbarPanelAlignment.End}
      />,
    );
    const renderProp = sut.find(PanelsProvider).prop("children");
    const rendered = shallow(renderProp!(undefined) as React.ReactElement<{}>);
    rendered.should.matchSnapshot();
  });
});
