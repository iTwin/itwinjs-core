/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { createRect } from "../Utils";

import { withContainIn } from "../../ui-ninezone";
import { RectangleProps, Rectangle } from "../../ui-ninezone/utilities/Rectangle";
import { containVertically, containHorizontally } from "../../ui-ninezone/base/WithContainIn";

const component = () => <div></div>;
// tslint:disable-next-line:variable-name
const ContainedComponent = withContainIn(component);

describe("<WithContainIn />", () => {
  let innerWidthStub: sinon.SinonStub | undefined;
  let innerHeightStub: sinon.SinonStub | undefined;
  let createRectangleStub: sinon.SinonStub | undefined;
  let createRefStub: sinon.SinonStub | undefined;

  afterEach(() => {
    innerWidthStub && innerWidthStub.restore();
    innerHeightStub && innerHeightStub.restore();
    createRectangleStub && createRectangleStub.restore();
    createRefStub && createRefStub.restore();
  });

  it("should render", () => {
    mount(<ContainedComponent />);
  });

  it("should not contain if container ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    createRefStub = sinon.stub(React, "createRef");
    createRefStub.returns(ref);
    mount(<ContainedComponent />);
  });

  it("should use window bounds when container reference is not set", () => {
    innerWidthStub = sinon.stub(window, "innerWidth").get(() => {
      return 333;
    });
    innerHeightStub = sinon.stub(window, "innerHeight").get(() => {
      return 222;
    });

    const ref = React.createRef<HTMLElement>();
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

    mount(
      <ContainedComponent
        container={ref}
        containFn={spy}
      />,
    );

    spy.calledOnce.should.true;
  });

  it("should use container bounds", () => {
    const container: React.MutableRefObject<HTMLDivElement | null> = {
      current: null,
    };
    const containFnSpy = sinon.spy((_: RectangleProps, containerBounds: RectangleProps): RectangleProps => {
      containerBounds.left.should.eq(50);
      containerBounds.top.should.eq(100);
      containerBounds.right.should.eq(200);
      containerBounds.bottom.should.eq(400);
      return new Rectangle();
    });

    mount(
      <div>
        <div
          ref={(instance) => {
            container.current = instance;

            if (!instance)
              return;
            sinon.stub(instance, "getBoundingClientRect").returns(createRect(50, 100, 200, 400));
          }}
        >
        </div>
        <ContainedComponent
          container={container}
          containFn={containFnSpy}
        />
      </div>,
    );

    containFnSpy.calledOnce.should.true;
  });

  it("should contain horizontally by delegating to Rectangle", () => {
    const expectedResult = new Rectangle();
    const createdRect = new Rectangle();
    const containHorizontallyInStub = sinon.stub(createdRect, "containHorizontallyIn").returns(expectedResult);
    createRectangleStub = sinon.stub(Rectangle, "create").returns(createdRect);

    const contained = containHorizontally(new Rectangle(), new Rectangle());
    createRectangleStub.calledOnce.should.true;
    containHorizontallyInStub.calledOnce.should.true;
    contained.should.eq(expectedResult);
  });

  it("should contain vertically by delegating to Rectangle", () => {
    const expectedResult = new Rectangle();
    const createdRect = new Rectangle();
    const containVerticallyInStub = sinon.stub(createdRect, "containVerticallyIn").returns(expectedResult);
    createRectangleStub = sinon.stub(Rectangle, "create").returns(createdRect);

    const contained = containVertically(new Rectangle(), new Rectangle());
    createRectangleStub.calledOnce.should.true;
    containVerticallyInStub.calledOnce.should.true;
    contained.should.eq(expectedResult);
  });
});
