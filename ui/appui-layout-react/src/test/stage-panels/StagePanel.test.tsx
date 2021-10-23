/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Point, Rectangle } from "@itwin/core-react";
import { ResizeGrip, SafeAreaInsets, StagePanel, StagePanelType, StagePanelTypeHelpers } from "../../appui-layout-react";
import { mount } from "../Utils";

describe("<StagePanel />", () => {
  it("should render", () => {
    mount(<StagePanel type={StagePanelType.Left} />);
  });

  it("renders vertically correctly", () => {
    shallow(<StagePanel type={StagePanelType.Left} />).should.matchSnapshot();
  });

  it("renders vertically with size correctly", () => {
    shallow(<StagePanel type={StagePanelType.Left} size={100} />).should.matchSnapshot();
  });

  it("renders horizontally correctly", () => {
    shallow(<StagePanel type={StagePanelType.Top} />).should.matchSnapshot();
  });

  it("renders horizontally with size correctly", () => {
    shallow(<StagePanel type={StagePanelType.Top} size={1000} />).should.matchSnapshot();
  });

  it("renders safe area aware correctly", () => {
    shallow(<StagePanel
      safeAreaInsets={SafeAreaInsets.All}
      type={StagePanelType.Left}
    />).should.matchSnapshot();
  });

  it("should invoke onResize handler", () => {
    const spy = sinon.spy();
    const sut = mount(<StagePanel
      type={StagePanelType.Left}
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip);

    grip.prop("onResizeStart")!({
      bounds: new Rectangle(),
      position: new Point(),
    });

    grip.prop("onResize")!({
      bounds: new Rectangle(),
      position: new Point(10, 20),
    });

    spy.calledWithExactly(10).should.true;
  });

  it("should invoke onResize handler for horizontal panel", () => {
    const spy = sinon.spy();
    const sut = mount(<StagePanel
      type={StagePanelType.Top}
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip);

    grip.prop("onResizeStart")!({
      bounds: new Rectangle(),
      position: new Point(),
    });

    grip.prop("onResize")!({
      bounds: new Rectangle(),
      position: new Point(10, 20),
    });

    spy.calledWithExactly(20).should.true;
  });

  it("should invoke onResize handler with negative grow direction", () => {
    const spy = sinon.spy();
    const sut = mount(<StagePanel
      type={StagePanelType.Right}
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip);

    grip.prop("onResizeStart")!({
      bounds: new Rectangle(),
      position: new Point(),
    });

    grip.prop("onResize")!({
      bounds: new Rectangle(),
      position: new Point(10, 20),
    });

    spy.calledWithExactly(-10).should.true;
  });

  it("should not invoke onResize handler if resize is not started", () => {
    const spy = sinon.spy();
    const sut = mount(<StagePanel
      type={StagePanelType.Left}
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip);

    grip.prop("onResize")!({
      bounds: new Rectangle(),
      position: new Point(10, 0),
    });

    spy.notCalled.should.true;
  });

  it("should not invoke onResize handler if drag direction does not match resize direction", () => {
    const spy = sinon.spy();
    const sut = mount(<StagePanel
      type={StagePanelType.Left}
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip);

    grip.prop("onResizeStart")!({
      bounds: new Rectangle(200, 0, 210, 1000),
      position: new Point(150, 0),
    });

    grip.prop("onResize")!({
      bounds: new Rectangle(0, 0, 10, 1000),
      position: new Point(140, 0),
    });

    spy.notCalled.should.true;
  });

  it("should not invoke onResize handler after resize ends", () => {
    const spy = sinon.spy();
    const sut = mount(<StagePanel
      type={StagePanelType.Left}
      onResize={spy}
    />);
    const grip = sut.find(ResizeGrip);

    grip.prop("onResizeStart")!({
      bounds: new Rectangle(),
      position: new Point(),
    });

    grip.prop("onResizeEnd")!({
      bounds: new Rectangle(),
      position: new Point(),
    });

    grip.prop("onResize")!({
      bounds: new Rectangle(),
      position: new Point(10, 0),
    });

    spy.notCalled.should.true;
  });
});

describe("StagePanelTypeHelpers", () => {
  it("should return bottom panel class name", () => {
    StagePanelTypeHelpers.getCssClassName(StagePanelType.Bottom).should.eq("nz-panel-bottom");
  });

  it("should return left panel class name", () => {
    StagePanelTypeHelpers.getCssClassName(StagePanelType.Left).should.eq("nz-panel-left");
  });

  it("should return right panel class name", () => {
    StagePanelTypeHelpers.getCssClassName(StagePanelType.Right).should.eq("nz-panel-right");
  });

  it("should return top panel class name", () => {
    StagePanelTypeHelpers.getCssClassName(StagePanelType.Top).should.eq("nz-panel-top");
  });

  it("isVertical should return true for left panel", () => {
    StagePanelTypeHelpers.isVertical(StagePanelType.Left).should.true;
  });

  it("isVertical should return true for right panel ", () => {
    StagePanelTypeHelpers.isVertical(StagePanelType.Right).should.true;
  });

  it("isVertical should return false for top panel ", () => {
    StagePanelTypeHelpers.isVertical(StagePanelType.Top).should.false;
  });

  it("isVertical should return false for bottom panel", () => {
    StagePanelTypeHelpers.isVertical(StagePanelType.Bottom).should.false;
  });
});
