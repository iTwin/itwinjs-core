/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Splitter } from "../../ui-ninezone";
import { createBoundingClientRect } from "../Utils";

describe("<Splitter />", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    mount(<Splitter />);
  });

  it("renders panes correctly", () => {
    shallow(
      <Splitter>
        <div />
        <div />
      </Splitter>,
    ).should.matchSnapshot();
  });

  it("renders panes vertically correctly", () => {
    shallow(
      <Splitter isVertical>
        <div />
        <div />
      </Splitter>,
    ).should.matchSnapshot();
  });

  it("should add document event listeners", () => {
    const addEventListenerSpy = sandbox.spy(document, "addEventListener");

    mount(<Splitter />);
    addEventListenerSpy.calledWith("pointerup").should.true;
    addEventListenerSpy.calledWith("pointermove").should.true;
    addEventListenerSpy.calledTwice.should.true;
  });

  it("should remove event listeners", () => {
    const removeEventListenerSpy = sandbox.spy(document, "removeEventListener");
    const sut = mount(<Splitter />);
    sut.unmount();

    removeEventListenerSpy.calledWith("pointerup").should.true;
    removeEventListenerSpy.calledWith("pointermove").should.true;
    removeEventListenerSpy.calledTwice.should.true;
  });

  it("layouts initially correctly", () => {
    const sut = mount<Splitter>(
      <Splitter>
        <div />
        <div />
      </Splitter>,
    );

    sut.state().sizeByPaneId[0].should.eq(50, "pane1");
    sut.state().sizeByPaneId[1].should.eq(50, "pane2");
  });

  it("layouts vertical initially correctly", () => {
    const sut = mount<Splitter>(
      <Splitter isVertical>
        <div />
        <div />
      </Splitter>,
    );

    sut.state().sizeByPaneId[0].should.eq(50, "pane1");
    sut.state().sizeByPaneId[1].should.eq(50, "pane2");
  });

  it("should skip unset grip refs in initial layout", () => {
    const gripRef = {
      current: null,
    };
    sinon.stub(gripRef, "current").set(() => { });

    const createRefStub = sandbox.stub(React, "createRef");
    createRefStub.onSecondCall().returns(gripRef);
    createRefStub.returns({ current: null });
    const sut = mount<Splitter>(
      <Splitter>
        <div />
        <div />
      </Splitter>,
    );

    sut.state().sizeByPaneId[0].should.eq(50, "pane1");
    sut.state().sizeByPaneId[1].should.eq(50, "pane2");
  });

  it("should re-layout if number of panes changes", () => {
    const sut = mount<Splitter>(
      <Splitter>
        <div />
        <div />
      </Splitter>,
    );

    sut.setProps({
      children: [
        <div />,
        <div />,
        <div />,
      ],
    });

    sut.state().sizeByPaneId[0].should.eq(100 / 3, "pane1");
    sut.state().sizeByPaneId[1].should.eq(100 / 3, "pane2");
    sut.state().sizeByPaneId[2].should.eq(100 / 3, "pane3");
  });

  it("should resize the panes", () => {
    const sut = mount<Splitter>(
      <Splitter>
        <div />
        <div />
      </Splitter>,
    );

    const splitterNode = sut.getDOMNode() as HTMLElement;
    sinon.stub(splitterNode, "getBoundingClientRect").returns(createBoundingClientRect(0, 0, 100, 0));
    const grip = sut.find(".nz-grip");
    const gripNode = grip.getDOMNode() as HTMLElement;
    sinon.stub(gripNode, "getBoundingClientRect").returns(createBoundingClientRect(40, 0, 60, 0));

    grip.simulate("pointerDown");

    const pointerMove = document.createEvent("MouseEvent");
    pointerMove.initEvent("pointermove");
    sinon.stub(pointerMove, "clientX").get(() => 30);
    document.dispatchEvent(pointerMove);

    sut.state().sizeByPaneId[0].should.eq(30, "pane1");
    sut.state().sizeByPaneId[1].should.eq(70, "pane2");
  });

  it("should resize the panes vertically", () => {
    const sut = mount<Splitter>(
      <Splitter isVertical>
        <div />
        <div />
      </Splitter>,
    );

    const splitterNode = sut.getDOMNode() as HTMLElement;
    sinon.stub(splitterNode, "getBoundingClientRect").returns(createBoundingClientRect(0, 0, 0, 100));
    const grip = sut.find(".nz-grip");
    const gripNode = grip.getDOMNode() as HTMLElement;
    sinon.stub(gripNode, "getBoundingClientRect").returns(createBoundingClientRect(0, 40, 0, 60));

    grip.simulate("pointerDown");

    const pointerMove = document.createEvent("MouseEvent");
    pointerMove.initEvent("pointermove");
    sinon.stub(pointerMove, "clientY").get(() => 70);
    document.dispatchEvent(pointerMove);

    sut.state().sizeByPaneId[0].should.eq(70, "pane1");
    sut.state().sizeByPaneId[1].should.eq(30, "pane2");
  });

  it("should not handle pointer move if grip ref is not set", () => {
    const gripRef = {
      current: null,
    };
    const createRefStub = sandbox.stub(React, "createRef");
    createRefStub.onSecondCall().returns(gripRef);
    createRefStub.returns({ current: null });
    const sut = mount<Splitter>(
      <Splitter>
        <div />
        <div />
      </Splitter>,
    );
    sut.setState({
      sizeByPaneId: {
        0: 40,
        1: 60,
      },
    });

    const grip = sut.find(".nz-grip");
    const gripNode = grip.getDOMNode() as HTMLElement;
    sinon.stub(gripNode, "getBoundingClientRect").returns(createBoundingClientRect(20, 0, 30, 0));

    grip.simulate("pointerDown");

    sinon.stub(gripRef, "current").get(() => null);

    const pointerMove = document.createEvent("MouseEvent");
    pointerMove.initEvent("pointermove");
    sinon.stub(pointerMove, "clientX").get(() => 30);
    document.dispatchEvent(pointerMove);

    sut.state().sizeByPaneId[0].should.eq(40, "pane1");
    sut.state().sizeByPaneId[1].should.eq(60, "pane2");
  });

  it("should not handle pointer move if pointer up is received", () => {
    const sut = mount<Splitter>(
      <Splitter>
        <div />
        <div />
      </Splitter>,
    );
    sut.setState({
      sizeByPaneId: {
        0: 40,
        1: 60,
      },
    });

    const grip = sut.find(".nz-grip");
    const gripNode = grip.getDOMNode() as HTMLElement;
    sinon.stub(gripNode, "getBoundingClientRect").returns(createBoundingClientRect(20, 0, 30, 0));

    grip.simulate("pointerDown");

    const pointerUp = document.createEvent("MouseEvent");
    pointerUp.initEvent("pointerup");
    document.dispatchEvent(pointerUp);

    const pointerMove = document.createEvent("MouseEvent");
    pointerMove.initEvent("pointermove");
    sinon.stub(pointerMove, "clientX").get(() => 30);
    document.dispatchEvent(pointerMove);

    sut.state().sizeByPaneId[0].should.eq(40, "pane1");
    sut.state().sizeByPaneId[1].should.eq(60, "pane2");
  });
});
