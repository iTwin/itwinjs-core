/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import { StandardMessageBox } from "../../src";
import { MessageBoxIconType, MessageBoxType } from "@bentley/imodeljs-frontend";

describe("StandardMessageBox", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("OK button & NoSymbol", () => {
    const spyMethod = sinon.spy();

    const reactNode = <StandardMessageBox
      opened={false}
      title="My Title"
      iconType={MessageBoxIconType.NoSymbol}
      messageBoxType={MessageBoxType.Ok}
      onResult={spyMethod}
    />;

    const wrapper = mount(reactNode);
    const buttonWrapper = wrapper.find("button.dialog-button"); // OK button
    buttonWrapper.simulate("click");
    expect(spyMethod.calledOnce).to.be.true;

    wrapper.unmount();

    shallow(reactNode).should.matchSnapshot();
  });

  it("OK/Cancel buttons & Information", () => {
    const spyMethod = sinon.spy();

    const reactNode = <StandardMessageBox
      opened={false}
      title="My Title"
      iconType={MessageBoxIconType.Information}
      messageBoxType={MessageBoxType.OkCancel}
      onResult={spyMethod}
    />;

    const wrapper = mount(reactNode);
    const buttonWrapper = wrapper.find("button.bwc-buttons-hollow");  // Cancel button
    buttonWrapper.simulate("click");
    expect(spyMethod.calledOnce).to.be.true;

    wrapper.unmount();

    shallow(reactNode).should.matchSnapshot();
  });

  it("Yes/No buttons & Question", () => {
    const spyMethod = sinon.spy();

    const reactNode = <StandardMessageBox
      opened={false}
      title="My Title"
      iconType={MessageBoxIconType.Question}
      messageBoxType={MessageBoxType.YesNo}
      onResult={spyMethod}
    />;

    const wrapper = mount(reactNode);
    const buttonWrapper = wrapper.find("span.icon-close");  // Close button
    buttonWrapper.simulate("click");
    expect(spyMethod.calledOnce).to.be.true;

    wrapper.unmount();

    shallow(reactNode).should.matchSnapshot();
  });

  it("MediumAlert & Question", () => {
    const reactNode = <StandardMessageBox
      opened={false}
      title="My Title"
      iconType={MessageBoxIconType.Warning}
      messageBoxType={MessageBoxType.MediumAlert}
    />;
    const wrapper = mount(reactNode);
    wrapper.unmount();

    shallow(reactNode).should.matchSnapshot();
  });

  it("YesNoCancel & Critical", () => {
    const reactNode = <StandardMessageBox
      opened={false}
      title="My Title"
      iconType={MessageBoxIconType.Critical}
      messageBoxType={MessageBoxType.YesNoCancel}
    />;
    const wrapper = mount(reactNode);
    wrapper.unmount();

    shallow(reactNode).should.matchSnapshot();
  });

});
