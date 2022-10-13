/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { IModelApp, MockRender } from "@itwin/core-frontend";
import { render, screen } from "@testing-library/react";
import { KeyinBrowser } from "../../appui-react";
import TestUtils, { storageMock, userEvent } from "../TestUtils";
import { EmptyLocalization } from "@itwin/core-common";

const myLocalStorage = storageMock();

const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(window, "localStorage")!;

class KeyinLocalization extends EmptyLocalization {
  public override getLocalizedString(key: string | string[]): string {
    switch (key) {
      case "tools.View.Pan.keyin":
        return "pan view";
      case "tools.Select.keyin":
        return "select";
      default:
        return typeof (key) == "string" ? key : key[0];
    }
  }
}

describe("<KeyinBrowser>", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  before(async () => {

    Object.defineProperty(window, "localStorage", {
      get: () => myLocalStorage,
    });

    await TestUtils.initializeUiFramework();
    // use mock renderer so standards tools are registered.
    // use Twist localization so the tools keyin and englishkeyin are not empty.
    await MockRender.App.startup({localization: new KeyinLocalization()});
  });

  after(async () => {
    await MockRender.App.shutdown();

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

  it("should invoke onExecute handler when execute button is clicked", async () => {
    const spy = sinon.spy();
    render(<KeyinBrowser onExecute={spy} />);

    await theUserTo.click(screen.getByRole("button"));

    spy.calledOnce.should.true;
  });

  it("Argument change should change state", async () => {
    render(<KeyinBrowser />);

    await theUserTo.type(screen.getByLabelText("keyinbrowser.args"), "abc");

    expect(screen.getByTestId<HTMLInputElement>("uif-keyin-arguments").value).to.eq("abc");
  });

  it("Enter key in args should invoke onExecute handler", async () => {
    const spy = sinon.spy();
    render(<KeyinBrowser onExecute={spy} />);

    await theUserTo.type(screen.getByLabelText("keyinbrowser.args"), "[Enter]");
    spy.calledOnce.should.true;
  });

  it("Enter key in AutoSuggest should invoke onExecute handler", async () => {
    const spy = sinon.spy();
    render(<KeyinBrowser onExecute={spy} />);

    await theUserTo.type(screen.getByLabelText("keyinbrowser.keyin"), "[Enter]");

    await TestUtils.flushAsyncOperations();
    spy.calledOnce.should.true;
  });

  it("Tab key in AutoSuggest should set currentToolId", async () => {
    const spy = sinon.spy();
    render(<KeyinBrowser onExecute={spy} />);
    await theUserTo.type(screen.getByLabelText("keyinbrowser.keyin"), "select[Tab]");

    await theUserTo.clear(screen.getByLabelText("keyinbrowser.keyin"));
    await theUserTo.type(screen.getByLabelText("keyinbrowser.keyin"), "pan view[Tab]");
    await theUserTo.type(screen.getByLabelText("keyinbrowser.keyin"), "[Enter]");
    expect(spy).to.have.been.calledWith(sinon.match({toolId: "View.Pan"}));
  });

  it("Escape key in AutoSuggest should invoke onCancel handler", async () => {
    const spy = sinon.spy();
    render(<KeyinBrowser onCancel={spy} />);

    await theUserTo.type(screen.getByLabelText("keyinbrowser.keyin"), "[Escape]");
    spy.calledOnceWithExactly().should.true;
  });

  it("Escape key in Args field should invoke onCancel handler", async () => {
    const spy = sinon.spy();
    render(<KeyinBrowser onCancel={spy} />);

    await theUserTo.type(screen.getByLabelText("keyinbrowser.args"), "[Escape]");
    spy.calledOnceWithExactly().should.true;
  });

  it("Trying to run key-in in unit test environment should invoke outputMessage with failure", async () => {
    const spyOutput = sinon.spy(IModelApp.notifications, "outputMessage");
    const spy = sinon.spy();
    render(<KeyinBrowser onExecute={spy} />);

    await theUserTo.type(screen.getByLabelText("keyinbrowser.keyin"), "select[Enter]");
    spyOutput.calledOnce.should.true;
  });

  it("Trying to run key-in with incorrect args should invoke outputMessage with failure", async () => {
    const spyOutput = sinon.spy(IModelApp.notifications, "outputMessage");
    const spy = sinon.spy();
    render(<KeyinBrowser onExecute={spy} />);

    await theUserTo.type(screen.getByLabelText("keyinbrowser.keyin"), "select");
    await theUserTo.type(screen.getByLabelText("keyinbrowser.args"), "abc[Enter]");
    spyOutput.calledOnce.should.true;
  });

});
