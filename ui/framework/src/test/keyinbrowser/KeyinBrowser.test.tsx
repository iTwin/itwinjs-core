/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Button, LabeledInput, AutoSuggest } from "@bentley/ui-core";
import {
  KeyinBrowser,
} from "../../ui-framework";
import TestUtils, { storageMock } from "../TestUtils";

import { MockRender, IModelApp } from "@bentley/imodeljs-frontend";

const myLocalStorage = storageMock();

const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(window, "localStorage")!;

describe("<KeyinBrowser>", () => {
  before(async () => {

    Object.defineProperty(window, "localStorage", {
      get: () => myLocalStorage,
    });

    await TestUtils.initializeUiFramework();
    // use mock renderer so standards tools are registered.
    MockRender.App.startup();
  });

  afterEach(cleanup);

  after(() => {
    MockRender.App.shutdown();

    // restore the overriden property getter
    Object.defineProperty(window, "localStorage", propertyDescriptorToRestore);

    TestUtils.terminateUiFramework();
  });

  it("test local storage mock", () => {
    window.localStorage.setItem("test1", "TestOne");
    window.localStorage.setItem("test2", "TestTwo");
    const first = window.localStorage.getItem("test1");
    expect(first).to.eq("TestOne");
    const two = window.localStorage.getItem("test2");
    expect(two).to.eq("TestTwo");
  });

  it("Renders properly", () => {
    const renderedComponent = render(<KeyinBrowser />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it.skip("Handles arguments", async () => {
    const renderedComponent = render(<KeyinBrowser />);
    expect(renderedComponent).not.to.be.undefined;
    renderedComponent.debug();

    // simulate selecting toolId
    let selectInput = renderedComponent.getByTestId("uif-keyin-autosuggest") as HTMLInputElement;
    fireEvent.change(selectInput, { target: { value: "Select" } });
    renderedComponent.debug();

    // execute button should trigger saving state of input fields
    const executeButton = renderedComponent.getByTestId("uif-keyin-browser-execute");
    fireEvent.click(executeButton);
    await TestUtils.flushAsyncOperations();

    // simulate specifying args
    let argInput = renderedComponent.getByTestId("uif-keyin-arguments") as HTMLInputElement;
    fireEvent.change(argInput, { target: { value: "marker.js|blue" } });

    // execute button should trigger saving state of input fields
    fireEvent.click(executeButton);
    await TestUtils.flushAsyncOperations();

    const savedToolId = window.localStorage.getItem("keyinbrowser:keyin");
    expect(savedToolId).to.eq("Select");

    const savedArgs = window.localStorage.getItem(`keyinbrowser:${savedToolId}`);
    expect(savedArgs).to.eq(`["marker.js","blue"]`);

    cleanup();

    // When we render the browser again it should show last used values
    const newlyRenderedComponent = render(<KeyinBrowser />);
    // newlyRenderedComponent.debug();

    selectInput = newlyRenderedComponent.getByTestId("uif-keyin-autosuggest") as HTMLInputElement;
    expect(selectInput.value).to.be.eq("Select");
    argInput = newlyRenderedComponent.getByTestId("uif-keyin-arguments") as HTMLInputElement;
    expect(argInput.value).to.be.eq("marker.js|blue");
  });

  it.skip("Enter key should process Execute Button processing", async () => {
    const renderedComponent = render(<KeyinBrowser />);
    expect(renderedComponent).not.to.be.undefined;

    // simulate selecting toolId
    const selectInput = renderedComponent.getByTestId("uif-keyin-autosuggest") as HTMLInputElement;
    fireEvent.change(selectInput, { target: { value: "Select" } });

    window.localStorage.setItem("keyinbrowser:keyin", "");
    // simulate specifying args
    const argInput = renderedComponent.getByTestId("uif-keyin-arguments") as HTMLInputElement;
    fireEvent.change(argInput, { target: { value: "marker.js|blue" } });
    expect(argInput.value).to.be.eq("marker.js|blue");

    // hitting enter should trigger execute button
    argInput.focus();
    fireEvent.keyDown(argInput, { key: "Enter" });
    await TestUtils.flushAsyncOperations();

    const savedToolId = window.localStorage.getItem("keyinbrowser:keyin");
    expect(savedToolId).to.eq("Select");

    const savedArgs = window.localStorage.getItem(`keyinbrowser:${savedToolId}`);
    expect(savedArgs).to.eq(`["marker.js","blue"]`);

    cleanup();
  });

  it("should invoke onExecute handler when execute button is clicked", async () => {
    const spy = sinon.spy();
    const sut = mount(<KeyinBrowser onExecute={spy} />);
    const btn = sut.find(Button);
    btn.simulate("click");
    spy.calledOnce.should.true;
    sut.unmount();
  });

  it("Argument change should change state", async () => {
    const wrapper = mount(<KeyinBrowser />);
    const labeledInput = wrapper.find(LabeledInput);
    expect(labeledInput.length).to.eq(1);

    const input = labeledInput.find("input");
    expect(input.length).to.eq(1);

    const value = "abc";
    input.simulate("change", { target: { value } });
    expect(wrapper.state("currentArgs")).to.eq(value);

    wrapper.unmount();
  });

  it("Enter key in args should invoke onExecute handler", async () => {
    const spy = sinon.spy();
    const wrapper = mount(<KeyinBrowser onExecute={spy} />);
    const labeledInput = wrapper.find(LabeledInput);
    expect(labeledInput.length).to.eq(1);

    const input = labeledInput.find("input");
    expect(input.length).to.eq(1);

    input.simulate("keydown", { key: "Enter" });
    spy.calledOnce.should.true;

    wrapper.unmount();
  });

  it("Enter key in AutoSuggest should invoke onExecute handler", async () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const spy = sinon.spy();
    const wrapper = mount(<KeyinBrowser onExecute={spy} />, { attachTo: outerNode });

    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input");
    expect(input.length).to.eq(1);

    const inputNode = input.getDOMNode() as HTMLInputElement;
    expect(inputNode).to.not.be.undefined;
    inputNode.focus();

    input.simulate("keydown", { key: "Enter" });
    await TestUtils.flushAsyncOperations();
    spy.calledOnce.should.true;

    wrapper.unmount();
    document.body.removeChild(outerNode);
  });

  it("Tab key in AutoSuggest should set currentToolId", async () => {
    const spy = sinon.spy();
    const wrapper = mount(<KeyinBrowser onExecute={spy} />);
    wrapper.setState({ currentToolId: "Select" });

    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input");
    expect(input.length).to.eq(1);

    input.simulate("change", { target: { value: "pan view" } });
    input.simulate("keydown", { key: "Tab" });
    expect(wrapper.state("currentToolId")).to.eq("Select");

    wrapper.unmount();
  });

  it("Escape key in AutoSuggest should invoke onCancel handler", async () => {
    const spy = sinon.spy();
    const wrapper = mount(<KeyinBrowser onCancel={spy} />);

    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input");
    expect(input.length).to.eq(1);

    input.simulate("keydown", { key: "Escape" });
    spy.calledOnceWithExactly().should.true;

    wrapper.unmount();
  });

  it("Escape key in Args field should invoke onCancel handler", async () => {
    const spy = sinon.spy();
    const wrapper = mount(<KeyinBrowser onCancel={spy} />);

    const labeledInput = wrapper.find(LabeledInput);
    expect(labeledInput.length).to.eq(1);

    const input = labeledInput.find("input");
    expect(input.length).to.eq(1);

    input.simulate("keydown", { key: "Escape" });
    spy.calledOnceWithExactly().should.true;

    wrapper.unmount();
  });

  it("Trying to run key-in in unit test environment should invoke outputMessage with failure", async () => {
    const spyOutput = sinon.spy(IModelApp.notifications, "outputMessage");
    const spy = sinon.spy();
    const wrapper = mount(<KeyinBrowser onExecute={spy} />);
    wrapper.setState({ currentToolId: "Select" });

    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input");
    expect(input.length).to.eq(1);

    input.simulate("keydown", { key: "Enter" });
    await TestUtils.flushAsyncOperations();
    spyOutput.calledOnce.should.true;

    wrapper.unmount();
    (IModelApp.notifications.outputMessage as any).restore();
  });

  it("Trying to run key-in with incorrect args should invoke outputMessage with failure", async () => {
    const spyOutput = sinon.spy(IModelApp.notifications, "outputMessage");
    const spy = sinon.spy();
    const wrapper = mount(<KeyinBrowser onExecute={spy} />);
    wrapper.setState({ currentToolId: "Select", currentArgs: "abc" });

    const autoSuggest = wrapper.find(AutoSuggest);
    expect(autoSuggest.length).to.eq(1);

    const input = autoSuggest.find("input");
    expect(input.length).to.eq(1);

    input.simulate("keydown", { key: "Enter" });
    await TestUtils.flushAsyncOperations();
    spyOutput.calledOnce.should.true;

    wrapper.unmount();
    (IModelApp.notifications.outputMessage as any).restore();
  });

});
