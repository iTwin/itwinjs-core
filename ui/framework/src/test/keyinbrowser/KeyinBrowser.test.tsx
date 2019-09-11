/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Button } from "@bentley/ui-core";
import {
  KeyinBrowser,
} from "../../ui-framework";
import TestUtils, { storageMock } from "../TestUtils";

import { MockRender } from "@bentley/imodeljs-frontend";

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

  it("Handles arguments", async () => {
    const renderedComponent = render(<KeyinBrowser />);
    expect(renderedComponent).not.to.be.undefined;

    // simulate selecting toolId
    let selectInput = renderedComponent.getByTestId("uif-keyin-select") as HTMLSelectElement;
    fireEvent.change(selectInput, { target: { value: "Select" } });

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

    selectInput = newlyRenderedComponent.getByTestId("uif-keyin-select") as HTMLSelectElement;
    expect(selectInput.value).to.be.eq("Select");
    argInput = newlyRenderedComponent.getByTestId("uif-keyin-arguments") as HTMLInputElement;
    expect(argInput.value).to.be.eq("marker.js|blue");
  });

  it("Enter key should process Execute Button processing", async () => {
    const renderedComponent = render(<KeyinBrowser />);
    expect(renderedComponent).not.to.be.undefined;

    // simulate selecting toolId
    const selectInput = renderedComponent.getByTestId("uif-keyin-select") as HTMLSelectElement;
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
    spy.calledOnceWithExactly().should.true;
  });

});
