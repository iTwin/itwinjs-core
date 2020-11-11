/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { mount, shallow } from "enzyme";
import { cleanup, fireEvent, render } from "@testing-library/react";
import sinon from "sinon";
import * as React from "react";
import { BasePropertyEditorParams, InputEditorSizeParams, PropertyEditorParamTypes, RangeEditorParams, StandardEditorNames } from "@bentley/ui-abstract";
import { NumericInputEditor } from "../../ui-components/editors/NumericInputEditor";
import TestUtils from "../TestUtils";
import { EditorContainer, PropertyUpdatedArgs } from "../../ui-components/editors/EditorContainer";

describe("<NumericInputEditor />", () => {
  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    sinon.restore();
  });

  afterEach(cleanup);

  after(() => {
    TestUtils.terminateUiComponents();
  });

  it("should render", () => {
    mount(<NumericInputEditor />);
  });

  it("renders correctly", () => {
    shallow(<NumericInputEditor />).should.matchSnapshot();
  });

  it("getValue returns proper value after componentDidMount & setState", async () => {
    const record = TestUtils.createNumericProperty("Test", 123, StandardEditorNames.NumericInput);
    const wrapper = mount(<NumericInputEditor propertyRecord={record} />);

    await TestUtils.flushAsyncOperations();
    const editor = wrapper.instance() as NumericInputEditor;
    expect(editor.state.value).to.equal(123);

    wrapper.unmount();
  });

  it("HTML input onChange updates value", () => {
    const record = TestUtils.createNumericProperty("Test1", 5, StandardEditorNames.NumericInput);

    const component = render(<NumericInputEditor propertyRecord={record} />);
    const input = component.container.querySelector("input") as HTMLInputElement;
    expect(input.value).to.eq("5");

    const incrementor = component.container.querySelectorAll("i");
    expect(incrementor.length).to.eq(2);
    fireEvent.mouseDown(incrementor[0]);
    fireEvent.mouseUp(incrementor[0]);
    expect(input.value).to.eq("6");

    cleanup();
  });

  it("componentDidUpdate updates the value", async () => {
    const record = TestUtils.createNumericProperty("Test", 123, StandardEditorNames.NumericInput);
    const wrapper = mount(<NumericInputEditor propertyRecord={record} />);

    await TestUtils.flushAsyncOperations();
    const editor = wrapper.instance() as NumericInputEditor;
    expect(editor.state.value).to.equal(123);

    const testValue = 987;
    const newRecord = TestUtils.createNumericProperty("Test", testValue, StandardEditorNames.NumericInput);
    wrapper.setProps({ propertyRecord: newRecord });
    await TestUtils.flushAsyncOperations();
    expect(editor.state.value).to.equal(testValue);

    wrapper.unmount();
  });

  it("should support InputEditorSize params", async () => {
    const size = 4;
    const maxLength = 60;
    const editorParams: BasePropertyEditorParams[] = [];
    const sizeParams: InputEditorSizeParams = {
      type: PropertyEditorParamTypes.InputEditorSize,
      size,
      maxLength,
    };
    editorParams.push(sizeParams);

    const record = TestUtils.createNumericProperty("Test", 123, StandardEditorNames.NumericInput, editorParams);
    const wrapper = mount(<NumericInputEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();

    const textEditor = wrapper.find(NumericInputEditor);
    expect(textEditor.length).to.eq(1);
    expect(textEditor.state("size")).to.eq(size);
    expect(textEditor.state("maxLength")).to.eq(maxLength);

    wrapper.unmount();
  });

  it("should support Range Editor Params", async () => {
    const editorParams: BasePropertyEditorParams[] = [];
    const rangeParams: RangeEditorParams = {
      type: PropertyEditorParamTypes.Range,
      minimum: 1,
      maximum: 100,
      step: 5,
      precision: 2,
    };
    editorParams.push(rangeParams);

    const record = TestUtils.createNumericProperty("Test", 123, StandardEditorNames.NumericInput, editorParams);
    const wrapper = mount(<NumericInputEditor propertyRecord={record} />);
    await TestUtils.flushAsyncOperations();

    const textEditor = wrapper.find(NumericInputEditor);
    expect(textEditor.length).to.eq(1);
    expect(textEditor.state("min")).to.eq(1);
    expect(textEditor.state("max")).to.eq(100);
    expect(textEditor.state("step")).to.eq(5);
    expect(textEditor.state("precision")).to.eq(2);

    wrapper.unmount();
  });

  it("renders editor for 'number' type and 'numeric-input' editor using NumericInputEditor", () => {
    const propertyRecord = TestUtils.createNumericProperty("Test", 123, StandardEditorNames.NumericInput);
    const renderedComponent = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />);
    expect(renderedComponent.container.querySelector(".components-numeric-input-editor")).to.not.be.empty;
    cleanup();
  });

  it("calls onCommit for Enter", async () => {
    const propertyRecord = TestUtils.createNumericProperty("Test", 123, StandardEditorNames.NumericInput);
    const spyOnCommit = sinon.spy();
    function handleCommit(_commit: PropertyUpdatedArgs): void {
      spyOnCommit();
    }
    const wrapper = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={handleCommit} onCancel={() => { }} />);
    const inputNode = wrapper.container.querySelector("input");
    expect(inputNode).not.to.be.null;

    fireEvent.keyDown(inputNode as HTMLElement, { key: "Enter" });
    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit.calledOnce).to.be.true;
  });

});
