/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";

import { ResizeGrip, ResizeDirection, ResizeDirectionHelpers, PointerCaptor } from "../../../ui-ninezone";
import { createRect } from "../../Utils";

describe("<ResizeGrip />", () => {
  let createRefStub: sinon.SinonStub | undefined;

  afterEach(() => {
    createRefStub && createRefStub.restore();
  });

  it("should render", () => {
    mount(<ResizeGrip direction={ResizeDirection.EastWest} />);
  });

  it("renders correctly", () => {
    shallow(<ResizeGrip direction={ResizeDirection.EastWest} />).should.matchSnapshot();
  });

  it("should invoke onResize handler", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResize={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);
    const gripElement = pointerCaptor.find("div").at(2).getDOMNode() as HTMLDivElement;
    sinon.stub(gripElement, "getBoundingClientRect").returns(createRect(20, 0, 25, 200));

    const mouseDown = new MouseEvent("");
    sinon.stub(mouseDown, "clientX").get(() => 10);
    sinon.stub(mouseDown, "clientY").get(() => 20);
    pointerCaptor.prop("onMouseDown")!(mouseDown);

    const mouseMove = new MouseEvent("");
    sinon.stub(mouseMove, "clientX").get(() => 20);
    sinon.stub(mouseMove, "clientY").get(() => 35);
    pointerCaptor.prop("onMouseMove")!(mouseMove);

    spy.calledWithExactly(10, 15).should.true;
  });

  it("should not resize on mouse move if mouse down was not received", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResize={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const mouseMove = new MouseEvent("");
    pointerCaptor.prop("onMouseMove")!(mouseMove);

    spy.notCalled.should.true;
  });

  it("should not resize on mouse move if mouse up was received", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResize={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const mouseDown = new MouseEvent("");
    pointerCaptor.prop("onMouseDown")!(mouseDown);

    const mouseUp = new MouseEvent("");
    pointerCaptor.prop("onMouseUp")!(mouseUp);

    const mouseMove = new MouseEvent("");
    pointerCaptor.prop("onMouseMove")!(mouseMove);

    spy.notCalled.should.true;
  });

  it("should not handle mouse down if grip ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    createRefStub = sinon.stub(React, "createRef");
    createRefStub.returns(ref);

    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResize={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const mouseDown = new MouseEvent("");
    pointerCaptor.prop("onMouseDown")!(mouseDown);

    const mouseMove = new MouseEvent("");
    pointerCaptor.prop("onMouseMove")!(mouseMove);

    spy.notCalled.should.true;
  });

  it("should not handle mouse move if grip ref is not set", () => {
    const ref = {
      current: null,
    };
    createRefStub = sinon.stub(React, "createRef");
    createRefStub.returns(ref);

    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResize={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const mouseDown = new MouseEvent("");
    pointerCaptor.prop("onMouseDown")!(mouseDown);

    sinon.stub(ref, "current").get(() => null);

    const mouseMove = new MouseEvent("");
    pointerCaptor.prop("onMouseMove")!(mouseMove);

    spy.notCalled.should.true;
  });

  it("should resize horizontally only", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.EastWest}
      onResize={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const mouseDown = new MouseEvent("");
    sinon.stub(mouseDown, "clientX").get(() => 10);
    sinon.stub(mouseDown, "clientY").get(() => 20);
    pointerCaptor.prop("onMouseDown")!(mouseDown);

    const mouseMove = new MouseEvent("");
    sinon.stub(mouseMove, "clientX").get(() => 20);
    sinon.stub(mouseMove, "clientY").get(() => 35);
    pointerCaptor.prop("onMouseMove")!(mouseMove);

    spy.calledWithExactly(10, 0).should.true;
  });

  it("should resize vertically only", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthSouth}
      onResize={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const mouseDown = new MouseEvent("");
    sinon.stub(mouseDown, "clientX").get(() => 10);
    sinon.stub(mouseDown, "clientY").get(() => 20);
    pointerCaptor.prop("onMouseDown")!(mouseDown);

    const mouseMove = new MouseEvent("");
    sinon.stub(mouseMove, "clientX").get(() => 20);
    sinon.stub(mouseMove, "clientY").get(() => 35);
    pointerCaptor.prop("onMouseMove")!(mouseMove);

    spy.calledWithExactly(0, 15).should.true;
  });
});

describe("ResizeDirectionHelpers", () => {
  it("should get class name for east west direction", () => {
    ResizeDirectionHelpers.getCssClassName(ResizeDirection.EastWest).should.eq("nz-direction-ew");
  });

  it("should get class name for nort south direction", () => {
    ResizeDirectionHelpers.getCssClassName(ResizeDirection.NorthSouth).should.eq("nz-direction-ns");
  });

  it("should get class name for nort-east south-west direction", () => {
    ResizeDirectionHelpers.getCssClassName(ResizeDirection.NorthEast_SouthWest).should.eq("nz-direction-ne-sw");
  });

  it("should get class name for north-west south-east direction", () => {
    ResizeDirectionHelpers.getCssClassName(ResizeDirection.NorthWest_SouthEast).should.eq("nz-direction-nw-se");
  });
});
