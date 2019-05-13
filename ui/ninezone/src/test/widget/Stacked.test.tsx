/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { createRect } from "../Utils";

import { Stacked, HorizontalAnchor, Edge } from "../../ui-ninezone";
import { VerticalAnchorHelpers, VerticalAnchor } from "../../ui-ninezone/widget/Stacked";
import { ResizeGrip } from "../../ui-ninezone/widget/rectangular/ResizeGrip";

describe("<Stacked />", () => {
  let createRefStub: sinon.SinonStub | undefined;

  afterEach(() => {
    createRefStub && createRefStub.restore();
  });

  it("should render", () => {
    mount(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle} />);
  });

  it("renders correctly", () => {
    shallow(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle} />).should.matchSnapshot();
  });

  it("renders dragged correctly", () => {
    shallow(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      isDragged />).should.matchSnapshot();
  });

  it("renders floating correctly", () => {
    shallow(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      isFloating />).should.matchSnapshot();
  });

  it("renders correctly to fill zone", () => {
    shallow(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      fillZone />).should.matchSnapshot();
  });

  it("should resize bottom edge", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);
    const bottomGrip = sut.find(ResizeGrip).at(0);
    bottomGrip.prop("onResize")!(0, 10);
    spy.calledWithExactly(0, 10, Edge.Bottom, 0);
  });

  it("should resize top edge", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);
    const bottomGrip = sut.find(ResizeGrip).at(3);
    bottomGrip.prop("onResize")!(0, 10);
    spy.calledWithExactly(0, 10, Edge.Top, 0);
  });

  it("should resize right edge with content grip", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);
    const bottomGrip = sut.find(ResizeGrip).at(1);
    bottomGrip.prop("onResize")!(0, 10);
    spy.calledWithExactly(0, 10, Edge.Right, 0);
  });

  it("should resize left edge with content grip", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Left}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);
    const bottomGrip = sut.find(ResizeGrip).at(1);
    bottomGrip.prop("onResize")!(0, 10);
    spy.calledWithExactly(0, 10, Edge.Left, 0);
  });

  it("should resize right edge with tabs grip", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Left}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);
    const bottomGrip = sut.find(ResizeGrip).at(2);
    bottomGrip.prop("onResize")!(0, 10);
    spy.calledWithExactly(0, 10, Edge.Right, 0);
  });

  it("should resize left edge with tabs grip", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);
    const bottomGrip = sut.find(ResizeGrip).at(2);
    bottomGrip.prop("onResize")!(0, 10);
    spy.calledWithExactly(0, 10, Edge.Left, 0);
  });

  it("should provide filled height difference", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);

    const widget = sut.find("div").first().getDOMNode() as HTMLDivElement;
    const clientHeightStub = sinon.stub(widget, "clientHeight");
    clientHeightStub.onFirstCall().returns(13);
    clientHeightStub.onSecondCall().returns(100);

    const bottomGrip = sut.find(ResizeGrip).at(0);
    bottomGrip.prop("onResize")!(0, 10);
    spy.calledWithExactly(0, 10, Edge.Bottom, 87);
  });

  it("should return 0 as filled height difference if widget ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    createRefStub = sinon.stub(React, "createRef");
    createRefStub.returns(ref);

    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);

    const widget = sut.find("div").first().getDOMNode() as HTMLDivElement;
    const clientHeightStub = sinon.stub(widget, "clientHeight");

    const bottomGrip = sut.find(ResizeGrip).at(0);
    bottomGrip.prop("onResize")!(0, 10);

    spy.calledWithExactly(0, 10, Edge.Bottom, 0);
    clientHeightStub.notCalled.should.true;
  });

  it("should get bounds", () => {
    const sut = mount<Stacked>(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle} />);
    const element = sut.getDOMNode() as HTMLDivElement;
    sinon.stub(element, "getBoundingClientRect").returns(createRect(10, 15, 20, 30));

    const result = sut.instance().getBounds();
    result.left.should.eq(10);
    result.top.should.eq(15);
    result.right.should.eq(20);
    result.bottom.should.eq(30);
  });

  it("should return initial rectangle if widget ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    createRefStub = sinon.stub(React, "createRef");
    createRefStub.returns(ref);
    const sut = mount<Stacked>(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle} />);
    const element = sut.getDOMNode() as HTMLDivElement;
    sinon.stub(element, "getBoundingClientRect").returns(createRect(10, 15, 20, 30));

    const result = sut.instance().getBounds();
    result.left.should.eq(0);
    result.top.should.eq(0);
    result.right.should.eq(0);
    result.bottom.should.eq(0);
  });
});

describe("VerticalAnchorHelpers", () => {
  it("should get middle anchor class name", () => {
    VerticalAnchorHelpers.getCssClassName(VerticalAnchor.Middle).should.eq("nz-middle-anchor");
  });

  it("should get bottom anchor class name", () => {
    VerticalAnchorHelpers.getCssClassName(VerticalAnchor.Bottom).should.eq("nz-bottom-anchor");
  });
});
