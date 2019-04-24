/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { HorizontalAnchor, WidgetContent } from "../../../ui-ninezone";

describe("<WidgetContent />", () => {
  let createRefStub: sinon.SinonStub | undefined;

  afterEach(() => {
    createRefStub && createRefStub.restore();
  });

  it("should render", () => {
    mount(<WidgetContent anchor={HorizontalAnchor.Right} />);
  });

  it("renders correctly", () => {
    shallow(<WidgetContent anchor={HorizontalAnchor.Right} />).should.matchSnapshot();
  });

  it("should use scroll offset from state", () => {
    const sut = mount<WidgetContent>(<WidgetContent anchor={HorizontalAnchor.Right} />);
    const child = sut.find("div").first();
    const node = sut.getDOMNode();

    // User scrolls.
    node.scrollLeft = 100;
    node.scrollTop = 150;
    child.simulate("scroll");

    // Node parent change.
    node.scrollLeft = 0;
    node.scrollTop = 0;

    // Force update
    sut.instance().forceUpdate();

    node.scrollLeft.should.eq(100);
    node.scrollTop.should.eq(150);
  });

  it("should not use scroll offset from state if content ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    createRefStub = sinon.stub(React, "createRef");
    createRefStub.returns(ref);

    const sut = mount<WidgetContent>(<WidgetContent anchor={HorizontalAnchor.Right} />);
    const child = sut.find("div").first();
    const node = sut.getDOMNode();

    // User scrolls.
    node.scrollLeft = 100;
    node.scrollTop = 150;
    child.simulate("scroll");

    // Node parent change.
    node.scrollLeft = 0;
    node.scrollTop = 0;

    // Force update
    sut.instance().forceUpdate();

    node.scrollLeft.should.eq(0);
    node.scrollTop.should.eq(0);
  });
});
