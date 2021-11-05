/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Point, Rectangle } from "@itwin/core-react";
import { ResizeGrip, ResizeHandle, ToolSettings, ToolSettingsProps } from "../../appui-layout-react";
import { createRect, mount } from "../Utils";

describe("<ToolSettings />", () => {
  it("should render", () => {
    mount(<ToolSettings />);
  });

  it("renders correctly", () => {
    shallow(<ToolSettings />).should.matchSnapshot();
  });

  it("renders correctly to fill zone", () => {
    shallow(<ToolSettings
      fillZone
    />).should.matchSnapshot();
  });

  it("renders draggable correctly", () => {
    shallow(<ToolSettings
      onDrag={sinon.spy}
    />).should.matchSnapshot();
  });

  it("renders resizable correctly", () => {
    shallow(<ToolSettings
      onResize={sinon.spy}
    />).should.matchSnapshot();
  });

  it("should get bounds", () => {
    const sut = mount<ToolSettings>(<ToolSettings />);
    const element = sut.find(".nz-widget").getDOMNode();
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
    sinon.stub(React, "createRef").returns(ref);
    const sut = mount<ToolSettings>(<ToolSettings />);
    const element = sut.getDOMNode();
    sinon.stub(element, "getBoundingClientRect").returns(createRect(10, 15, 20, 30));

    const result = sut.instance().getBounds();
    result.left.should.eq(0);
    result.top.should.eq(0);
    result.right.should.eq(0);
    result.bottom.should.eq(0);
  });

  it("should resize top", () => {
    const spy = sinon.stub<Required<ToolSettingsProps>["onResize"]>();
    const sut = mount(<ToolSettings
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip).filter(".nz-top-grip");
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(0, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(10, ResizeHandle.Top).should.true;
  });

  it("should resize bottom", () => {
    const spy = sinon.stub<Required<ToolSettingsProps>["onResize"]>();
    const sut = mount(<ToolSettings
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip).filter(".nz-bottom-grip");
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(0, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(10, ResizeHandle.Bottom).should.true;
  });

  it("should resize right", () => {
    const spy = sinon.stub<Required<ToolSettingsProps>["onResize"]>();
    const sut = mount(<ToolSettings
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip).filter(".nz-right-grip");
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(10, 0),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(10, ResizeHandle.Right).should.true;
  });

  it("should resize left", () => {
    const spy = sinon.stub<Required<ToolSettingsProps>["onResize"]>();
    const sut = mount(<ToolSettings
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip).filter(".nz-left-grip");
    grip.prop("onResizeStart")!({
      position: new Point(),
      bounds: new Rectangle(),
    });
    grip.prop("onResize")!({
      position: new Point(-10, 0),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(-10, ResizeHandle.Left).should.true;
  });

  it("should not resize if resize is not started", () => {
    const spy = sinon.stub<Required<ToolSettingsProps>["onResize"]>();
    const sut = mount(<ToolSettings
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip).at(0);
    grip.prop("onResize")!({
      position: new Point(0, 10),
      bounds: new Rectangle(),
    });
    spy.notCalled.should.true;
  });

  it("should not resize if resize is started and ended", () => {
    const spy = sinon.stub<Required<ToolSettingsProps>["onResize"]>();
    const sut = mount(<ToolSettings
      onResize={spy}
    />);
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
