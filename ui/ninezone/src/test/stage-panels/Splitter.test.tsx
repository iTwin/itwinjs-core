/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Splitter } from "../../ui-ninezone";
import { createRect } from "../Utils";

describe("<Splitter />", () => {
  let addEventListenerSpy: sinon.SinonSpy | undefined;
  let removeEventListenerSpy: sinon.SinonSpy | undefined;
  let createRefStub: sinon.SinonStub | undefined;

  afterEach(() => {
    addEventListenerSpy && addEventListenerSpy.restore();
    removeEventListenerSpy && removeEventListenerSpy.restore();
    createRefStub && createRefStub.restore();
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
    addEventListenerSpy = sinon.spy(document, "addEventListener");

    mount(<Splitter />);
    addEventListenerSpy.calledWith("mouseup").should.true;
    addEventListenerSpy.calledWith("mousemove").should.true;
    addEventListenerSpy.calledTwice.should.true;
  });

  it("should remove event listeners", () => {
    removeEventListenerSpy = sinon.spy(document, "removeEventListener");
    const sut = mount(<Splitter />);
    sut.unmount();

    removeEventListenerSpy.calledWith("mouseup").should.true;
    removeEventListenerSpy.calledWith("mousemove").should.true;
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

    createRefStub = sinon.stub(React, "createRef");
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
    sinon.stub(splitterNode, "getBoundingClientRect").returns(createRect(0, 0, 100, 0));
    const grip = sut.find(".nz-grip");
    const gripNode = grip.getDOMNode() as HTMLElement;
    sinon.stub(gripNode, "getBoundingClientRect").returns(createRect(40, 0, 60, 0));

    grip.simulate("mouseDown");

    const mouseMove = document.createEvent("MouseEvent");
    mouseMove.initEvent("mousemove");
    sinon.stub(mouseMove, "clientX").get(() => 30);
    document.dispatchEvent(mouseMove);

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
    sinon.stub(splitterNode, "getBoundingClientRect").returns(createRect(0, 0, 0, 100));
    const grip = sut.find(".nz-grip");
    const gripNode = grip.getDOMNode() as HTMLElement;
    sinon.stub(gripNode, "getBoundingClientRect").returns(createRect(0, 40, 0, 60));

    grip.simulate("mouseDown");

    const mouseMove = document.createEvent("MouseEvent");
    mouseMove.initEvent("mousemove");
    sinon.stub(mouseMove, "clientY").get(() => 70);
    document.dispatchEvent(mouseMove);

    sut.state().sizeByPaneId[0].should.eq(70, "pane1");
    sut.state().sizeByPaneId[1].should.eq(30, "pane2");
  });

  it("should not handle mouse move if grip ref is not set", () => {
    const gripRef = {
      current: null,
    };
    createRefStub = sinon.stub(React, "createRef");
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
    sinon.stub(gripNode, "getBoundingClientRect").returns(createRect(20, 0, 30, 0));

    grip.simulate("mouseDown");

    sinon.stub(gripRef, "current").get(() => null);

    const mouseMove = document.createEvent("MouseEvent");
    mouseMove.initEvent("mousemove");
    sinon.stub(mouseMove, "clientX").get(() => 30);
    document.dispatchEvent(mouseMove);

    sut.state().sizeByPaneId[0].should.eq(40, "pane1");
    sut.state().sizeByPaneId[1].should.eq(60, "pane2");
  });

  it("should not handle mouse move if mouse up is received", () => {
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
    sinon.stub(gripNode, "getBoundingClientRect").returns(createRect(20, 0, 30, 0));

    grip.simulate("mouseDown");

    const mouseUp = document.createEvent("MouseEvent");
    mouseUp.initEvent("mouseup");
    document.dispatchEvent(mouseUp);

    const mouseMove = document.createEvent("MouseEvent");
    mouseMove.initEvent("mousemove");
    sinon.stub(mouseMove, "clientX").get(() => 30);
    document.dispatchEvent(mouseMove);

    sut.state().sizeByPaneId[0].should.eq(40, "pane1");
    sut.state().sizeByPaneId[1].should.eq(60, "pane2");
  });
});
