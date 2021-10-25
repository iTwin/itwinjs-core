/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { MessageBoxIconType, MessageBoxType } from "@itwin/core-frontend";
import { render } from "@testing-library/react";
import { StandardMessageBox } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("StandardMessageBox", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("OK button & NoSymbol", () => {
    const spyMethod = sinon.spy();

    const reactNode = <StandardMessageBox
      opened={true}
      title="My Title"
      iconType={MessageBoxIconType.NoSymbol}
      messageBoxType={MessageBoxType.Ok}
      onResult={spyMethod}
    />;

    const wrapper = mount(reactNode);
    const buttonWrapper = wrapper.find("button.dialog-button-ok");
    buttonWrapper.simulate("click");
    expect(spyMethod.calledOnce).to.be.true;

    shallow(reactNode).should.matchSnapshot();
  });

  it("OK/Cancel buttons & Information", () => {
    const spyMethod = sinon.spy();

    const reactNode = <StandardMessageBox
      opened={true}
      title="My Title"
      iconType={MessageBoxIconType.Information}
      messageBoxType={MessageBoxType.OkCancel}
      onResult={spyMethod}
    />;

    const wrapper = mount(reactNode);
    const buttonWrapper = wrapper.find("button.dialog-button-ok");
    buttonWrapper.simulate("click");
    expect(spyMethod.calledOnce).to.be.true;

    shallow(reactNode).should.matchSnapshot();
  });

  it("Yes/No buttons & Question", () => {
    const spyMethod = sinon.spy();

    const reactNode = <StandardMessageBox
      opened={true}
      title="My Title"
      iconType={MessageBoxIconType.Question}
      messageBoxType={MessageBoxType.YesNo}
      onResult={spyMethod}
    />;

    const wrapper = mount(reactNode);
    const buttonWrapper = wrapper.find("button.dialog-button-yes");
    buttonWrapper.simulate("click");
    expect(spyMethod.calledOnce).to.be.true;

    shallow(reactNode).should.matchSnapshot();
  });

  it("MediumAlert & Question", () => {
    const spyMethod = sinon.spy();
    const reactNode = <StandardMessageBox
      opened={true}
      title="My Title"
      iconType={MessageBoxIconType.Warning}
      messageBoxType={MessageBoxType.MediumAlert}
      onResult={spyMethod}
    />;
    const wrapper = mount(reactNode);
    const buttonWrapper = wrapper.find("button.dialog-button-cancel");
    buttonWrapper.simulate("click");
    expect(spyMethod.calledOnce).to.be.true;

    shallow(reactNode).should.matchSnapshot();
  });

  it("YesNoCancel & Critical", () => {
    const spyMethod = sinon.spy();
    const reactNode = <StandardMessageBox
      opened={true}
      title="My Title"
      iconType={MessageBoxIconType.Critical}
      messageBoxType={MessageBoxType.YesNoCancel}
      onResult={spyMethod}
    />;
    const wrapper = mount(reactNode);

    const buttonWrapper = wrapper.find("button.dialog-button-no");
    buttonWrapper.simulate("click");
    expect(spyMethod.calledOnce).to.be.true;

    shallow(reactNode).should.matchSnapshot();
  });

  it("YesNoCancel & Warning", () => {
    const spyMethod = sinon.spy();
    const reactNode = <StandardMessageBox
      opened={true}
      title="My Title"
      iconType={MessageBoxIconType.Warning}
      messageBoxType={MessageBoxType.YesNoCancel}
      onResult={spyMethod}
    />;
    const wrapper = mount(reactNode);

    const buttonWrapper = wrapper.find("button.dialog-button-cancel");
    buttonWrapper.simulate("click");
    expect(spyMethod.calledOnce).to.be.true;

    shallow(reactNode).should.matchSnapshot();
  });

  it("should close on Esc key", () => {
    const spyOnEscape = sinon.spy();
    const reactNode = <StandardMessageBox
      opened={true}
      title="My Title"
      iconType={MessageBoxIconType.NoSymbol}
      messageBoxType={MessageBoxType.Ok}
      onResult={spyOnEscape}
    />;
    const component = render(reactNode);

    component.baseElement.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape" }));
    spyOnEscape.calledOnce.should.true;
  });

});
