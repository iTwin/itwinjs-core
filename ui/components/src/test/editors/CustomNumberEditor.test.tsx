/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { render, cleanup, fireEvent } from "react-testing-library";
import * as sinon from "sinon";
import { expect } from "chai";
import { PropertyRecord, PrimitiveValue, PropertyEditorParamTypes } from "@bentley/imodeljs-frontend";
import { EditorContainer, PropertyUpdatedArgs } from "../../ui-components/editors/EditorContainer";

import { CustomNumberEditor } from "../../ui-components/editors/CustomNumberEditor";
import TestUtils from "../TestUtils";

const numVal = 3.345689;
const displayVal = "3.35";

describe("<CustomNumberEditor />", () => {
  afterEach(cleanup);

  it("should render", () => {

    const record = TestUtils.createCustomNumberProperty("FormattedNumber", numVal, displayVal);
    const renderedComponent = render(<CustomNumberEditor propertyRecord={record} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("change input value", () => {

    const record = TestUtils.createCustomNumberProperty("FormattedNumber", numVal, displayVal);
    const renderedComponent = render(<CustomNumberEditor propertyRecord={record} />);
    expect(renderedComponent).not.to.be.undefined;
    const inputField = renderedComponent.getByTestId("components-customnumber-editor") as HTMLInputElement;
    expect(inputField.value).to.be.equal(displayVal);
    const newValue = "7.777";
    fireEvent.change(inputField, { target: { value: newValue } });
    expect(inputField.value).to.be.equal(newValue);
  });

  it("EditorContainer with CustomNumberPropertyEditor", async () => {
    const spyOnCommit = sinon.spy();
    function handleCommit(commit: PropertyUpdatedArgs): void {
      const numValue = (commit.newValue as PrimitiveValue).value as number;
      const displayValue = (commit.newValue as PrimitiveValue).displayValue;
      expect(numValue).to.be.equal(7.777);
      expect(displayValue).to.be.equal("7.78");
      spyOnCommit();
    }
    const propertyRecord = TestUtils.createCustomNumberProperty("FormattedNumber", numVal, displayVal) as PropertyRecord;
    const renderedComponent = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={handleCommit} onCancel={() => { }} />);
    // renderedComponent.debug();
    const inputField = renderedComponent.getByTestId("components-customnumber-editor") as HTMLInputElement;
    expect(inputField.value).to.be.equal(displayVal);
    const newValue = "7.777";
    fireEvent.change(inputField, { target: { value: newValue } });
    expect(inputField.value).to.be.equal(newValue);
    const container = renderedComponent.getByTestId("editor-container") as HTMLSpanElement;
    fireEvent.keyDown(container, { key: "Enter" });
    await TestUtils.flushAsyncOperations();
    // renderedComponent.debug();
    expect(spyOnCommit).to.be.calledOnce;
  });

  it("CustomNumberPropertyEditor with undefined initial display value", async () => {
    const spyOnCommit = sinon.spy();
    function handleCommit(commit: PropertyUpdatedArgs): void {
      const newNumValue = (commit.newValue as PrimitiveValue).value as number;
      const newDisplayValue = (commit.newValue as PrimitiveValue).displayValue;
      expect(newNumValue).to.be.equal(7.777);
      expect(newDisplayValue).to.be.equal("7.78");
      spyOnCommit();
    }

    function handleBadKeyinCommit(commit: PropertyUpdatedArgs): void {
      const newNumValue = (commit.newValue as PrimitiveValue).value as number;
      const newDisplayValue = (commit.newValue as PrimitiveValue).displayValue;
      expect(newNumValue).to.be.equal(numVal);
      expect(newDisplayValue).to.be.equal(displayVal);
      spyOnCommit();
    }

    const propertyRecord = TestUtils.createCustomNumberProperty("FormattedNumber", numVal) as PropertyRecord;
    // add size and width params for testing
    propertyRecord.property.editor!.params!.push(
      {
        type: PropertyEditorParamTypes.InputEditorSize,
        size: 8,
        maxLength: 20,
      });
    const renderedComponent = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={handleCommit} onCancel={() => { }} />);
    // renderedComponent.debug();
    const inputField = renderedComponent.getByTestId("components-customnumber-editor") as HTMLInputElement;
    expect(inputField.value).to.be.equal(displayVal);
    const newValue = "7.777";
    fireEvent.change(inputField, { target: { value: newValue } });
    expect(inputField.value).to.be.equal(newValue);
    const container = renderedComponent.getByTestId("editor-container") as HTMLSpanElement;
    fireEvent.keyDown(container, { key: "Enter" });
    await TestUtils.flushAsyncOperations();
    // renderedComponent.debug();
    expect(spyOnCommit).to.be.calledOnce;

    // trigger componentDidUpdate processing
    const newPropertyRecord = TestUtils.createCustomNumberProperty("FormattedNumber", numVal, displayVal) as PropertyRecord;
    renderedComponent.rerender(<EditorContainer propertyRecord={newPropertyRecord} title="abc" onCommit={handleBadKeyinCommit} onCancel={() => { }} />);

    // handle bad value processing
    const badValue = "abcd";
    fireEvent.change(inputField, { target: { value: badValue } });
    fireEvent.keyDown(container, { key: "Enter" });
    await TestUtils.flushAsyncOperations();  // make sure handleBadKeyinCommit is processed
  });

  it("EditorContainer with readonly CustomNumberPropertyEditor", async () => {
    const spyOnCommit = sinon.spy();
    function handleCommit(commit: PropertyUpdatedArgs): void {
      const newNumValue = (commit.newValue as PrimitiveValue).value as number;
      const newDisplayValue = (commit.newValue as PrimitiveValue).displayValue;
      expect(newNumValue).to.be.equal(numVal);
      expect(newDisplayValue).to.be.equal(displayVal);
      spyOnCommit();
    }

    const propertyRecord = TestUtils.createCustomNumberProperty("FormattedNumber", numVal, displayVal) as PropertyRecord;
    propertyRecord.isReadonly = true;
    propertyRecord.isDisabled = true;

    const renderedComponent = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={handleCommit} onCancel={() => { }} />);
    const inputField = renderedComponent.getByTestId("components-customnumber-editor") as HTMLInputElement;
    expect(inputField.value).to.be.equal(displayVal);
    const newValue = "7.777";
    fireEvent.change(inputField, { target: { value: newValue } });
    expect(inputField.value).to.be.equal(displayVal);
    const container = renderedComponent.getByTestId("editor-container") as HTMLSpanElement;
    fireEvent.keyDown(container, { key: "Enter" });
    await TestUtils.flushAsyncOperations();
    expect(spyOnCommit).not.to.be.called;
    // renderedComponent.debug();
    expect(inputField.value).to.be.equal(displayVal);
  });

  it("test with no editor params", async () => {
    const propertyRecord = TestUtils.createCustomNumberProperty("FormattedNumber", numVal, displayVal) as PropertyRecord;
    propertyRecord.property.editor!.params!.splice(0, 1);

    const renderedComponent = render(<EditorContainer propertyRecord={propertyRecord} title="abc" onCommit={() => { }} onCancel={() => { }} />);
    // renderedComponent.debug();
    const inputField = renderedComponent.queryByTestId("components-customnumber-editor") as HTMLInputElement;
    expect(inputField).to.be.null;
  });

});
