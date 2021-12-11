/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { SplitPane } from "../../appui-react";

describe("SplitPane", () => {
  it("should render with defaults", async () => {
    const componentWrapper = render(<SplitPane
      className="test-split-pane" style={{ backgroundColor: "blue" }}
      pane1ClassName="pane-one-class" pane1Style={{ backgroundColor: "blue" }}
      pane2ClassName="pane-two-class" pane2Style={{ backgroundColor: "blue" }}
      resizerStyle={{ backgroundColor: "blue" }} >
      <div>one</div>
      <div>two</div>
    </SplitPane>);
    expect(componentWrapper.container.querySelectorAll(".pane-one-class").length).to.eql(1);
    expect(componentWrapper.container.querySelectorAll(".pane-two-class").length).to.eql(1);
    const splitPane = componentWrapper.container.querySelector(".SplitPane.vertical.test-split-pane");
    expect(splitPane!.getAttribute("style")).to.include("background-color: blue;");
    const resizer = componentWrapper.container.querySelector(".vertical.Resizer");
    expect(resizer!.getAttribute("style")).to.include("background-color: blue;");
    const pane1 = componentWrapper.container.querySelector(".Pane.vertical.Pane1.pane-one-class");
    expect(pane1!.getAttribute("style")).to.include("background-color: blue;");
    const pane2 = componentWrapper.container.querySelector(".Pane.vertical.Pane2.pane-two-class");
    expect(pane2!.getAttribute("style")).to.include("background-color: blue;");
  });

  it("should render with vertical split", async () => {
    const componentWrapper = render(<SplitPane split="vertical" primary="first"
      className="test-split-pane" style={{ backgroundColor: "blue" }}
      pane1ClassName="pane-one-class" pane1Style={{ backgroundColor: "blue" }}
      pane2ClassName="pane-two-class" pane2Style={{ backgroundColor: "blue" }}
      resizerStyle={{ backgroundColor: "blue" }} >
      <div>one</div>
      <div>two</div>
    </SplitPane>);
    expect(componentWrapper.container.querySelectorAll(".pane-one-class").length).to.eql(1);
    expect(componentWrapper.container.querySelectorAll(".pane-two-class").length).to.eql(1);
    const splitPane = componentWrapper.container.querySelector(".SplitPane.vertical.test-split-pane");
    expect(splitPane!.getAttribute("style")).to.include("background-color: blue;");
    const resizer = componentWrapper.container.querySelector(".vertical.Resizer");
    expect(resizer!.getAttribute("style")).to.include("background-color: blue;");
    const pane1 = componentWrapper.container.querySelector(".Pane.vertical.Pane1.pane-one-class");
    expect(pane1!.getAttribute("style")).to.include("background-color: blue;");
    const pane2 = componentWrapper.container.querySelector(".Pane.vertical.Pane2.pane-two-class");
    expect(pane2!.getAttribute("style")).to.include("background-color: blue;");
  });

  it("should render with horizontal split", async () => {
    const componentWrapper = render(<SplitPane split="horizontal" primary="second"
      className="test-split-pane" style={{ backgroundColor: "blue" }}
      pane1ClassName="pane-one-class" pane1Style={{ backgroundColor: "blue" }}
      pane2ClassName="pane-two-class" pane2Style={{ backgroundColor: "blue" }}
      resizerStyle={{ backgroundColor: "blue" }} >
      <div>one</div>
      <div>two</div>
    </SplitPane>);
    expect(componentWrapper.container.querySelectorAll(".pane-one-class").length).to.eql(1);
    expect(componentWrapper.container.querySelectorAll(".pane-two-class").length).to.eql(1);
    const splitPane = componentWrapper.container.querySelector(".SplitPane.horizontal.test-split-pane");
    expect(splitPane!.getAttribute("style")).to.include("background-color: blue;");
    const resizer = componentWrapper.container.querySelector(".horizontal.Resizer");
    expect(resizer!.getAttribute("style")).to.include("background-color: blue;");
    const pane1 = componentWrapper.container.querySelector(".Pane.horizontal.Pane1.pane-one-class");
    expect(pane1!.getAttribute("style")).to.include("background-color: blue;");
    const pane2 = componentWrapper.container.querySelector(".Pane.horizontal.Pane2.pane-two-class");
    expect(pane2!.getAttribute("style")).to.include("background-color: blue;");
  });

  it("should handle click on resizer", async () => {
    const spyMethod = sinon.spy();
    const dblSpyMethod = sinon.spy();
    const componentWrapper = render(<SplitPane split="horizontal" primary="first"
      onResizerClick={spyMethod} onResizerDoubleClick={dblSpyMethod} >
      <div>one</div>
      <div>two</div>
    </SplitPane>);
    const resizer = componentWrapper.container.querySelector(".horizontal.Resizer");
    fireEvent.click(resizer!);
    fireEvent.dblClick(resizer!);
    spyMethod.calledOnce.should.true;
    dblSpyMethod.calledOnce.should.true;
  });

  it("should handle touch resizing", async () => {
    const spyMethod = sinon.spy();
    const spyDragFinishMethod = sinon.spy();
    const componentWrapper = render(<SplitPane split="horizontal" primary="first"
      onChange={spyMethod} onDragFinished={spyDragFinishMethod}
    >
      <div>one</div>
      <div>two</div>
    </SplitPane>);
    const resizer = componentWrapper.container.querySelector(".horizontal.Resizer");
    fireEvent.touchStart(resizer!, {
      touches: [{
        clientX: 10,
        clientY: 10,
      }],
    });
    fireEvent.touchMove(resizer!, {
      touches: [{
        clientX: 10,
        clientY: 20,
      }],
    });
    fireEvent.touchEnd(resizer!, {
      touches: [{
        clientX: 10,
        clientY: 20,
      }],
    });
    spyMethod.called.should.true;
    spyDragFinishMethod.called.should.true;
  });

  it("should handle mouse resizing", async () => {
    const spyMethod = sinon.spy();
    const spyDragStartedMethod = sinon.spy();
    const componentWrapper = render(<SplitPane split="horizontal" primary="second"
      onChange={spyMethod} minSize={40} size={80} step={1} maxSize={100} onDragStarted={spyDragStartedMethod}
    >
      <div>one</div>
      <div>two</div>
    </SplitPane>);
    const resizer = componentWrapper.container.querySelector(".horizontal.Resizer");
    fireEvent.mouseDown(resizer!, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(resizer!, { clientX: 10, clientY: 20 });
    fireEvent.mouseUp(resizer!, { clientX: 10, clientY: 30 });
    spyMethod.called.should.true;
    spyDragStartedMethod.called.should.true;
  });

  it("should handle mouse resizing (vertical)", async () => {
    const spyMethod = sinon.spy();
    const spyDragStartedMethod = sinon.spy();
    const componentWrapper = render(<SplitPane split="vertical" primary="first"
      onChange={spyMethod} minSize={40} size={80} step={1} maxSize={100} onDragStarted={spyDragStartedMethod}
    >
      <div>one</div>
      <div>two</div>
    </SplitPane>);
    const resizer = componentWrapper.container.querySelector(".vertical.Resizer");
    fireEvent.mouseDown(resizer!, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(resizer!, { clientX: 20, clientY: 10 });
    fireEvent.mouseUp(resizer!, { clientX: 30, clientY: 10 });
    spyMethod.called.should.true;
    spyDragStartedMethod.called.should.true;
  });

  it("should ignore mouse resizing", async () => {
    const spyMethod = sinon.spy();
    const componentWrapper = render(<SplitPane split="horizontal" primary="second"
      onChange={spyMethod} minSize={40} size={80} step={1} maxSize={100} allowResize={false}
    >
      <div>one</div>
      <div>two</div>
    </SplitPane>);
    const resizer = componentWrapper.container.querySelector(".horizontal.Resizer");
    fireEvent.mouseDown(resizer!, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(resizer!, { clientX: 10, clientY: 20 });
    fireEvent.mouseUp(resizer!, { clientX: 10, clientY: 30 });
    spyMethod.called.should.false;
  });

});
