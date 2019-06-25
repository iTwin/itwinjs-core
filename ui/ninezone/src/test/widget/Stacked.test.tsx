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
import { Point } from "../../ui-ninezone/utilities/Point";
import { Rectangle } from "../../ui-ninezone/utilities/Rectangle";

describe("<Stacked />", () => {
  let createRefStub: sinon.SinonStub | undefined;

  afterEach(() => {
    createRefStub && createRefStub.restore();
  });

  it("should render", () => {
    mount(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
    />);
  });

  it("renders correctly", () => {
    shallow(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
    />).should.matchSnapshot();
  });

  it("renders horizontal correctly", () => {
    shallow(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.TopPanel}
      onResize={sinon.spy()}
    />).should.matchSnapshot();
  });

  it("renders dragged correctly", () => {
    shallow(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      isDragged
    />).should.matchSnapshot();
  });

  it("renders floating correctly", () => {
    shallow(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      isFloating
    />).should.matchSnapshot();
  });

  it("renders correctly to fill zone", () => {
    shallow(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      fillZone
    />).should.matchSnapshot();
  });

  it("renders collapsed correctly", () => {
    shallow(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      isCollapsed
    />).should.matchSnapshot();
  });

  it("renders with tab bar correctly", () => {
    shallow(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      isTabBarVisible
    />).should.matchSnapshot();
  });

  it("should resize bottom edge", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);
    const grip = sut.find(ResizeGrip).at(0);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(0, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(0, 10, Edge.Bottom, 0).should.true;
  });

  it("should resize bottom edge when widget vertical anchor is bottom panel", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.BottomPanel}
      onResize={spy} />);
    const grip = sut.find(ResizeGrip).at(1);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(0, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(0, 10, Edge.Bottom, 0).should.true;
  });

  it("should resize top edge", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);
    const grip = sut.find(ResizeGrip).at(3);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(0, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(0, 10, Edge.Top, 0).should.true;
  });

  it("should resize top edge when widget vertical anchored is top panel", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.TopPanel}
      onResize={spy} />);
    const grip = sut.find(ResizeGrip).at(1);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(0, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(0, 10, Edge.Top, 0).should.true;
  });

  it("should resize right edge with content grip", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);
    const grip = sut.find(ResizeGrip).at(1);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(10, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(10, 0, Edge.Right, 0).should.true;
  });

  it("should resize right edge when widget is horizontal", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.TopPanel}
      onResize={spy} />);
    const grip = sut.find(ResizeGrip).at(0);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(10, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(10, 0, Edge.Right, 0).should.true;
  });

  it("should resize left edge with content grip", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Left}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip).at(1);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(10, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(10, 0, Edge.Left, 0).should.true;
  });

  it("should resize left edge when widget is horizontal", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.TopPanel}
      onResize={spy} />);
    const grip = sut.find(ResizeGrip).at(3);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(10, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(10, 0, Edge.Left, 0).should.true;
  });

  it("should resize right edge with tabs grip", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Left}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip).at(2);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(10, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(10, 0, Edge.Right, 0).should.true;
  });

  it("should resize top edge when widget vertical anchor is bottom panel", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Left}
      verticalAnchor={VerticalAnchor.BottomPanel}
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip).at(2);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(10, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(0, 10, Edge.Top, 0).should.true;
  });

  it("should resize top edge when widget vertical anchored is top panel", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Left}
      verticalAnchor={VerticalAnchor.TopPanel}
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip).at(2);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(10, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(0, 10, Edge.Bottom, 0).should.true;
  });

  it("should resize left edge with tabs grip", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip).at(2);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(10, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(10, 0, Edge.Left, 0).should.true;
  });

  it("should provide filled height difference", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy}
    />);

    const widget = sut.find("div").first().getDOMNode() as HTMLDivElement;
    const clientHeightStub = sinon.stub(widget, "clientHeight");
    clientHeightStub.get(() => {
      clientHeightStub.get(() => 100);
      return 13;
    });

    const grip = sut.find(ResizeGrip).at(0);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(10, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(0, 10, Edge.Bottom, 87).should.true;
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
      onResize={spy}
    />);

    const widget = sut.find("div").first().getDOMNode() as HTMLDivElement;
    const clientHeightStub = sinon.stub(widget, "clientHeight");

    const grip = sut.find(ResizeGrip).at(0);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(0, 10),
      bounds: new Rectangle(),
    });

    spy.calledWithExactly(0, 10, Edge.Bottom, 0).should.true;
    clientHeightStub.notCalled.should.true;
  });

  it("should get bounds", () => {
    const sut = mount<Stacked>(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
    />);
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
      verticalAnchor={VerticalAnchor.Middle}
    />);
    const element = sut.getDOMNode() as HTMLDivElement;
    sinon.stub(element, "getBoundingClientRect").returns(createRect(10, 15, 20, 30));

    const result = sut.instance().getBounds();
    result.left.should.eq(0);
    result.top.should.eq(0);
    result.right.should.eq(0);
    result.bottom.should.eq(0);
  });

  it("should not resize bottom grip if resize is not started", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);
    const grip = sut.find(ResizeGrip).at(0);
    grip.prop("onResize")!({
      position: new Point(0, 10),
      bounds: new Rectangle(),
    });
    spy.notCalled.should.true;
  });

  it("should not resize content grip if resize is not started", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);
    const grip = sut.find(ResizeGrip).at(1);
    grip.prop("onResize")!({
      position: new Point(0, 10),
      bounds: new Rectangle(),
    });
    spy.notCalled.should.true;
  });

  it("should not resize tabs grip if resize is not started", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);
    const grip = sut.find(ResizeGrip).at(2);
    grip.prop("onResize")!({
      position: new Point(0, 10),
      bounds: new Rectangle(),
    });
    spy.notCalled.should.true;
  });

  it("should not resize top grip if resize is not started", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);
    const grip = sut.find(ResizeGrip).at(3);
    grip.prop("onResize")!({
      position: new Point(0, 10),
      bounds: new Rectangle(),
    });
    spy.notCalled.should.true;
  });

  it("should not resize if resize ends", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
      onResize={spy} />);
    const grip = sut.find(ResizeGrip).at(0);
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResizeEnd")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(0, 10),
      bounds: new Rectangle(),
    });
    spy.notCalled.should.true;
  });
});

describe("VerticalAnchorHelpers", () => {
  it("should get middle anchor class name", () => {
    VerticalAnchorHelpers.getCssClassName(VerticalAnchor.Middle).should.eq("nz-middle-anchor");
  });

  it("should get bottom panel anchor class name", () => {
    VerticalAnchorHelpers.getCssClassName(VerticalAnchor.BottomPanel).should.eq("nz-bottom-panel-anchor");
  });

  it("should get bottom anchor class name", () => {
    VerticalAnchorHelpers.getCssClassName(VerticalAnchor.Bottom).should.eq("nz-bottom-anchor");
  });

  it("should get top panel anchor class name", () => {
    VerticalAnchorHelpers.getCssClassName(VerticalAnchor.TopPanel).should.eq("nz-top-panel-anchor");
  });

  it("should return true for bottom panel", () => {
    VerticalAnchorHelpers.isHorizontal(VerticalAnchor.BottomPanel).should.true;
  });

  it("should return true for top panel", () => {
    VerticalAnchorHelpers.isHorizontal(VerticalAnchor.TopPanel).should.true;
  });
});
