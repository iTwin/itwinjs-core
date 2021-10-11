/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Point, Rectangle } from "@itwin/core-react";
import { DisabledResizeHandles, HorizontalAnchor, ResizeGrip, ResizeHandle, Stacked, VerticalAnchor, VerticalAnchorHelpers } from "../../appui-layout-react";
import { createRect, mount } from "../Utils";

describe("<Stacked />", () => {
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
      isDragged
      verticalAnchor={VerticalAnchor.Middle}
    />).should.matchSnapshot();
  });

  it("renders floating correctly", () => {
    shallow(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      isFloating
      verticalAnchor={VerticalAnchor.Middle}
    />).should.matchSnapshot();
  });

  it("renders correctly to fill zone", () => {
    shallow(<Stacked
      fillZone
      horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
    />).should.matchSnapshot();
  });

  it("renders collapsed correctly", () => {
    shallow(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      isCollapsed
      verticalAnchor={VerticalAnchor.Middle}
    />).should.matchSnapshot();
  });

  it("renders with tab bar correctly", () => {
    shallow(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      isTabBarVisible
      verticalAnchor={VerticalAnchor.Middle}
    />).should.matchSnapshot();
  });

  describe("onResize", () => {
    describe("tabs grip", () => {
      it("should resize top", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Left}
          onResize={spy}
          verticalAnchor={VerticalAnchor.BottomPanel}
        />);
        const grip = sut.find(ResizeGrip).at(2);
        grip.prop("onResizeStart")!({
          position: new Point(),
          bounds: new Rectangle(),
        });
        grip.prop("onResize")!({
          position: new Point(0, 10),
          bounds: new Rectangle(),
        });
        spy.calledWithExactly(10, ResizeHandle.Top, 0).should.true;
      });

      it("should resize bottom", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Left}
          onResize={spy}
          verticalAnchor={VerticalAnchor.TopPanel}
        />);
        const grip = sut.find(ResizeGrip).at(2);
        grip.prop("onResizeStart")!({
          position: new Point(),
          bounds: new Rectangle(),
        });
        grip.prop("onResize")!({
          position: new Point(0, 10),
          bounds: new Rectangle(),
        });
        spy.calledWithExactly(10, ResizeHandle.Bottom, 0).should.true;
      });

      it("should resize right", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Left}
          onResize={spy}
          verticalAnchor={VerticalAnchor.Middle}
        />);
        const grip = sut.find(ResizeGrip).at(2);
        grip.prop("onResizeStart")!({
          position: new Point(),
          bounds: new Rectangle(),
        });
        grip.prop("onResize")!({
          position: new Point(10, 0),
          bounds: new Rectangle(),
        });
        spy.calledWithExactly(10, ResizeHandle.Right, 0).should.true;
      });

      it("should resize left", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Right}
          onResize={spy}
          verticalAnchor={VerticalAnchor.Middle}
        />);
        const grip = sut.find(ResizeGrip).at(2);
        grip.prop("onResizeStart")!({
          position: new Point(),
          bounds: new Rectangle(),
        });
        grip.prop("onResize")!({
          position: new Point(-10, 0),
          bounds: new Rectangle(),
        });
        spy.calledWithExactly(-10, ResizeHandle.Left, 0).should.true;
      });

      it("should not resize if resize is not started", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Right}
          onResize={spy}
          verticalAnchor={VerticalAnchor.Middle}
        />);
        const grip = sut.find(ResizeGrip).at(2);
        grip.prop("onResize")!({
          position: new Point(0, 10),
          bounds: new Rectangle(),
        });
        spy.notCalled.should.true;
      });
    });

    describe("content grip", () => {
      it("should resize bottom", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Right}
          onResize={spy}
          verticalAnchor={VerticalAnchor.BottomPanel}
        />);
        const grip = sut.find(ResizeGrip).at(1);
        grip.prop("onResizeStart")!({
          position: new Point(),
          bounds: new Rectangle(),
        });
        grip.prop("onResize")!({
          position: new Point(0, 10),
          bounds: new Rectangle(),
        });
        spy.calledWithExactly(10, ResizeHandle.Bottom, 0).should.true;
      });

      it("should resize top", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Right}
          onResize={spy}
          verticalAnchor={VerticalAnchor.TopPanel}
        />);
        const grip = sut.find(ResizeGrip).at(1);
        grip.prop("onResizeStart")!({
          position: new Point(),
          bounds: new Rectangle(),
        });
        grip.prop("onResize")!({
          position: new Point(0, 10),
          bounds: new Rectangle(),
        });
        spy.calledWithExactly(10, ResizeHandle.Top, 0).should.true;
      });

      it("should resize left", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Left}
          onResize={spy}
          verticalAnchor={VerticalAnchor.Middle}
        />);
        const grip = sut.find(ResizeGrip).at(1);
        grip.prop("onResizeStart")!({
          position: new Point(),
          bounds: new Rectangle(),
        });
        grip.prop("onResize")!({
          position: new Point(-10, 0),
          bounds: new Rectangle(),
        });
        spy.calledWithExactly(-10, ResizeHandle.Left, 0).should.true;
      });

      it("should resize right", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Right}
          onResize={spy}
          verticalAnchor={VerticalAnchor.Middle}
        />);
        const grip = sut.find(ResizeGrip).at(1);
        grip.prop("onResizeStart")!({
          position: new Point(),
          bounds: new Rectangle(),
        });
        grip.prop("onResize")!({
          position: new Point(10, 0),
          bounds: new Rectangle(),
        });
        spy.calledWithExactly(10, ResizeHandle.Right, 0).should.true;
      });

      it("should not resize if resize is not started", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Right}
          onResize={spy}
          verticalAnchor={VerticalAnchor.Middle}
        />);
        const grip = sut.find(ResizeGrip).at(1);
        grip.prop("onResize")!({
          position: new Point(0, 10),
          bounds: new Rectangle(),
        });
        spy.notCalled.should.true;
      });
    });

    describe("primary grip", () => {
      it("should resize left", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Right}
          onResize={spy}
          verticalAnchor={VerticalAnchor.TopPanel}
        />);
        const grip = sut.find(ResizeGrip).at(3);
        grip.prop("onResizeStart")!({
          position: new Point(),
          bounds: new Rectangle(),
        });
        grip.prop("onResize")!({
          position: new Point(10, 0),
          bounds: new Rectangle(),
        });
        spy.calledWithExactly(10, ResizeHandle.Left, 0).should.true;
      });

      it("should resize top", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Right}
          onResize={spy}
          verticalAnchor={VerticalAnchor.Middle}
        />);
        const grip = sut.find(ResizeGrip).at(3);
        grip.prop("onResizeStart")!({
          position: new Point(),
          bounds: new Rectangle(),
        });
        grip.prop("onResize")!({
          position: new Point(0, 10),
          bounds: new Rectangle(),
        });
        spy.calledWithExactly(10, ResizeHandle.Top, 0).should.true;
      });

      it("should not resize if resize is not started", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Right}
          onResize={spy}
          verticalAnchor={VerticalAnchor.Middle}
        />);
        const grip = sut.find(ResizeGrip).at(3);
        grip.prop("onResize")!({
          position: new Point(0, 10),
          bounds: new Rectangle(),
        });
        spy.notCalled.should.true;
      });
    });

    describe("secondary grip", () => {
      it("should resize bottom", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Right}
          onResize={spy}
          verticalAnchor={VerticalAnchor.Middle}
        />);
        const grip = sut.find(ResizeGrip).at(0);
        grip.prop("onResizeStart")!({
          position: new Point(),
          bounds: new Rectangle(),
        });
        grip.prop("onResize")!({
          position: new Point(0, 10),
          bounds: new Rectangle(),
        });
        spy.calledWithExactly(10, ResizeHandle.Bottom, 0).should.true;
      });

      it("should resize right", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Right}
          onResize={spy}
          verticalAnchor={VerticalAnchor.TopPanel}
        />);
        const grip = sut.find(ResizeGrip).at(0);
        grip.prop("onResizeStart")!({
          position: new Point(),
          bounds: new Rectangle(),
        });
        grip.prop("onResize")!({
          position: new Point(10, 0),
          bounds: new Rectangle(),
        });
        spy.calledWithExactly(10, ResizeHandle.Right, 0).should.true;
      });

      it("should not resize if resize is not started", () => {
        const spy = sinon.spy();
        const sut = mount(<Stacked
          horizontalAnchor={HorizontalAnchor.Right}
          onResize={spy}
          verticalAnchor={VerticalAnchor.Middle}
        />);
        const grip = sut.find(ResizeGrip).at(0);
        grip.prop("onResize")!({
          position: new Point(0, 10),
          bounds: new Rectangle(),
        });
        spy.notCalled.should.true;
      });
    });
  });

  it("should provide filled height difference", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      onResize={spy}
      verticalAnchor={VerticalAnchor.Middle}
    />);

    const widget = sut.find("div").first().getDOMNode();
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
      position: new Point(0, 10),
      bounds: new Rectangle(),
    });
    spy.calledWithExactly(10, ResizeHandle.Bottom, 87).should.true;
  });

  it("should return 0 as filled height difference if widget ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    sinon.stub(React, "createRef").returns(ref);

    const spy = sinon.spy();
    const sut = mount(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      onResize={spy}
      verticalAnchor={VerticalAnchor.Middle}
    />);

    const widget = sut.find("div").first().getDOMNode();
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

    spy.calledWithExactly(10, ResizeHandle.Bottom, 0).should.true;
    clientHeightStub.notCalled.should.true;
  });

  it("should get bounds", () => {
    const sut = mount<Stacked>(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
    />);
    const element = sut.getDOMNode();
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
    const sut = mount<Stacked>(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      verticalAnchor={VerticalAnchor.Middle}
    />);
    const element = sut.getDOMNode();
    sinon.stub(element, "getBoundingClientRect").returns(createRect(10, 15, 20, 30));

    const result = sut.instance().getBounds();
    result.left.should.eq(0);
    result.top.should.eq(0);
    result.right.should.eq(0);
    result.bottom.should.eq(0);
  });

  it("should not resize if resize ends", () => {
    const spy = sinon.spy();
    const sut = mount(<Stacked
      horizontalAnchor={HorizontalAnchor.Right}
      onResize={spy}
      verticalAnchor={VerticalAnchor.Middle}
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

  it("should disable resize handles", () => {
    shallow(<Stacked
      disabledResizeHandles={DisabledResizeHandles.Left | DisabledResizeHandles.Bottom}
      horizontalAnchor={HorizontalAnchor.Right}
      onResize={sinon.spy()}
      verticalAnchor={VerticalAnchor.Middle}
    />).should.matchSnapshot();
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
