/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { mount, shallow } from "enzyme";
import { cleanup, fireEvent, render, waitForElement } from "@testing-library/react";
import sinon from "sinon";
import * as React from "react";
import { InputEditorSizeParams, MultilineTextEditorParams, PropertyEditorInfo,
  PropertyEditorParamTypes, SpecialKey, StandardEditorNames } from "@bentley/ui-abstract";
import { TextareaEditor } from "../../ui-components/editors/TextareaEditor";
import { EditorContainer } from "../../ui-components/editors/EditorContainer";
import TestUtils from "../TestUtils";

describe("<TextareaEditor />", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  it("should render", () => {
    mount(<TextareaEditor />);
  });

  it("renders correctly", () => {
    shallow(<TextareaEditor />).should.matchSnapshot();
  });

  it("renders correctly with style", () => {
    shallow(<TextareaEditor style={{ color: "red" }} />).should.matchSnapshot();
  });

  it("getValue returns proper value after componentDidMount & setState", async () => {
    const record = TestUtils.createPrimitiveStringProperty("Test", "MyValue");
    const wrapper = mount(<TextareaEditor propertyRecord={record} />);

    await TestUtils.flushAsyncOperations();
    const editor = wrapper.instance() as TextareaEditor;
    expect(editor.state.inputValue).to.equal("MyValue");

    wrapper.unmount();
  });

  it("HTML input onChange updates value", async () => {
    const record = TestUtils.createPrimitiveStringProperty("Test1", "MyValue");
    const wrapper = mount(<TextareaEditor propertyRecord={record} />);

    const button = wrapper.find(".components-popup-button");
    expect(button.length).to.eq(1);
    button.first().simulate("click");
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const editor = wrapper.instance() as TextareaEditor;
    const textareaNode = wrapper.find("textarea");

    expect(textareaNode.length).to.eq(1);
    if (textareaNode) {
      const testValue = "My new value";
      textareaNode.simulate("change", { target: { value: testValue } });
      wrapper.update();
      expect(editor.state.inputValue).to.equal(testValue);
    }

    wrapper.unmount();
  });

  it("componentDidUpdate updates the value", async () => {
    const record = TestUtils.createPrimitiveStringProperty("Test", "MyValue");
    const wrapper = mount(<TextareaEditor propertyRecord={record} />);

    await TestUtils.flushAsyncOperations();
    const editor = wrapper.instance() as TextareaEditor;
    expect(editor.state.inputValue).to.equal("MyValue");

    const testValue = "MyNewValue";
    const newRecord = TestUtils.createPrimitiveStringProperty("Test", testValue);
    wrapper.setProps({ propertyRecord: newRecord });
    await TestUtils.flushAsyncOperations();
    expect(editor.state.inputValue).to.equal(testValue);

    wrapper.unmount();
  });

  it("should support InputEditorSize params", async () => {
    const size = 4;
    const maxLength = 60;
    const editorInfo: PropertyEditorInfo = {
      params: [
        {
          type: PropertyEditorParamTypes.InputEditorSize,
          size,
          maxLength,
        } as InputEditorSizeParams,
      ],
    };

    const record = TestUtils.createPrimitiveStringProperty("Test", "MyValue", "Test", editorInfo);
    const wrapper = mount(<TextareaEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();

    const textEditor = wrapper.find(TextareaEditor);
    expect(textEditor.length).to.eq(1);
    expect(textEditor.state("size")).to.eq(size);
    expect(textEditor.state("maxLength")).to.eq(maxLength);

    wrapper.unmount();
  });

  it("should support MultilineTextEditor Params", async () => {
    const editorInfo: PropertyEditorInfo = {
      params: [
        {
          type: PropertyEditorParamTypes.MultilineText,
          rows: 4,
        } as MultilineTextEditorParams,
      ],
    };

    const record = TestUtils.createPrimitiveStringProperty("Test", "MyValue", "Test", editorInfo);
    const wrapper = mount(<TextareaEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();

    const textEditor = wrapper.find(TextareaEditor);
    expect(textEditor.length).to.eq(1);
    expect(textEditor.state("rows")).to.eq(4);

    wrapper.unmount();
  });

  it("calls onCommit on OK button click", async () => {
    const spyOnCommit = sinon.spy();
    const record = TestUtils.createPrimitiveStringProperty("Test1", "MyValue");
    const wrapper = mount(<TextareaEditor propertyRecord={record} onCommit={spyOnCommit} />);

    const button = wrapper.find(".components-popup-button");
    expect(button.length).to.eq(1);
    button.first().simulate("click");
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const okButton = wrapper.find("button.components-popup-ok-button");
    expect(okButton.length).to.eq(1);
    okButton.first().simulate("click");
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    expect(spyOnCommit.calledOnce).to.be.true;

    wrapper.unmount();
  });

  it("calls onCancel on Cancel button click", async () => {
    const spyOnCancel = sinon.spy();
    const record = TestUtils.createPrimitiveStringProperty("Test1", "MyValue");
    const wrapper = mount(<TextareaEditor propertyRecord={record} onCancel={spyOnCancel} />);

    const button = wrapper.find(".components-popup-button");
    expect(button.length).to.eq(1);
    button.first().simulate("click");
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const okButton = wrapper.find("button.components-popup-cancel-button");
    expect(okButton.length).to.eq(1);
    okButton.first().simulate("click");
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    expect(spyOnCancel.calledOnce).to.be.true;

    wrapper.unmount();
  });

  it("renders editor for 'text' type and 'multi=line' editor using TextareaEditor", () => {
    const editorInfo: PropertyEditorInfo = {
      name: StandardEditorNames.MultiLine,
    };
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test", "MyValue", undefined, editorInfo);
    const renderedComponent = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />);
    expect(renderedComponent.container.querySelector(".components-textarea-editor")).to.not.be.empty;
    cleanup();
  });

  it("calls onCancel on Escape on button", async () => {
    const editorInfo: PropertyEditorInfo = {
      name: StandardEditorNames.MultiLine,
    };
    const propertyRecord = TestUtils.createPrimitiveStringProperty("Test", "MyValue", undefined, editorInfo);

    const spyOnCommit = sinon.spy();
    const spyOnCancel = sinon.spy();
    const renderedComponent = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={spyOnCommit} onCancel={spyOnCancel} />);
    expect(renderedComponent).not.to.be.undefined;
    const popupButton = await waitForElement(() => renderedComponent.getByTestId("components-popup-button"));
    expect(popupButton).not.to.be.null;

    fireEvent.keyDown(popupButton, { key: SpecialKey.Escape });
    await TestUtils.flushAsyncOperations();
    expect(spyOnCancel.calledOnce).to.be.true;
  });

});
