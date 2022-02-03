/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import type { RectangleProps } from "@itwin/core-react";
import { Rectangle } from "@itwin/core-react";
import { containHorizontally, containVertically, withContainIn } from "../../appui-layout-react";
import { createRect, mount } from "../Utils";

const component = () => <div></div>;
// eslint-disable-next-line @typescript-eslint/naming-convention
const ContainedComponent = withContainIn(component);

describe("<WithContainIn />", () => {
  it("should render", () => {
    mount(<ContainedComponent />);
  });

  it("should not contain if container ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    sinon.stub(React, "createRef").returns(ref);
    mount(<ContainedComponent />);
  });

  it("should use window bounds when container reference is not set", () => {
    sinon.stub(window, "innerWidth").get(() => {
      return 333;
    });
    sinon.stub(window, "innerHeight").get(() => {
      return 222;
    });

    const spy = sinon.spy((_: RectangleProps, containerBounds: RectangleProps): RectangleProps => {
      containerBounds.right.should.eq(333);
      containerBounds.bottom.should.eq(222);
      return {
        bottom: 50,
        left: 10,
        right: 40,
        top: 20,
      };
    });

    mount(<ContainedComponent
      containFn={spy}
    />);

    spy.calledOnce.should.true;
  });

  it("should use container bounds", () => {
    const container = document.createElement("div");
    sinon.stub(container, "getBoundingClientRect").returns(createRect(50, 100, 200, 400));
    const containFnSpy = sinon.spy((_: RectangleProps, containerBounds: RectangleProps): RectangleProps => {
      containerBounds.left.should.eq(50);
      containerBounds.top.should.eq(100);
      containerBounds.right.should.eq(200);
      containerBounds.bottom.should.eq(400);
      return new Rectangle();
    });

    mount(<ContainedComponent
      container={container}
      containFn={containFnSpy}
    />);

    containFnSpy.calledOnce.should.true;
  });

  it("should contain horizontally by delegating to Rectangle", () => {
    const expectedResult = new Rectangle();
    const createdRect = new Rectangle();
    const containHorizontallyInStub = sinon.stub(createdRect, "containHorizontallyIn").returns(expectedResult);
    const createRectangleStub = sinon.stub(Rectangle, "create").returns(createdRect);

    const contained = containHorizontally(new Rectangle(), new Rectangle());
    createRectangleStub.calledOnce.should.true;
    containHorizontallyInStub.calledOnce.should.true;
    contained.should.eq(expectedResult);
  });

  it("should contain vertically by delegating to Rectangle", () => {
    const expectedResult = new Rectangle();
    const createdRect = new Rectangle();
    const containVerticallyInStub = sinon.stub(createdRect, "containVerticallyIn").returns(expectedResult);
    const createRectangleStub = sinon.stub(Rectangle, "create").returns(createdRect);

    const contained = containVertically(new Rectangle(), new Rectangle());
    createRectangleStub.calledOnce.should.true;
    containVerticallyInStub.calledOnce.should.true;
    contained.should.eq(expectedResult);
  });
});
