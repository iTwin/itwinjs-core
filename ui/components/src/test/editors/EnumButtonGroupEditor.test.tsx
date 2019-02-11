/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { render, cleanup, fireEvent, waitForElement } from "react-testing-library";
import { expect } from "chai";
import sinon from "sinon";
import { EnumButtonGroupEditor } from "../../ui-components/editors/EnumButtonGroupEditor";
import { PropertyUpdatedArgs } from "../../ui-components/editors/EditorContainer";
import TestUtils from "../TestUtils";
import { PrimitiveValue } from "@bentley/imodeljs-frontend";

describe("<EnumButtonGroupEditor />", () => {
  afterEach(cleanup);

  it("should render", () => {
    const renderedComponent = render(<EnumButtonGroupEditor />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("editor with buttons renders correctly", async () => {
    const record = TestUtils.createEnumProperty("Test", 0);
    TestUtils.addEnumButtonGroupEditorSpecification(record);
    const renderedComponent = render(<EnumButtonGroupEditor propertyRecord={record} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("button press updates value and display", async () => {
    const record = TestUtils.createEnumProperty("Test", 0);
    TestUtils.addEnumButtonGroupEditorSpecification(record);

    const originalValue = (record.value as PrimitiveValue).value as number;
    expect(originalValue).to.be.equal(0);

    const spyOnCommit = sinon.spy();
    function handleCommit(commit: PropertyUpdatedArgs): void {
      const newValue = (commit.newValue as PrimitiveValue).value as number;
      expect(newValue).to.be.equal(2);
      spyOnCommit();
    }

    const renderedComponent = render(<EnumButtonGroupEditor propertyRecord={record} onCommit={handleCommit} />);
    const greenButton = renderedComponent.getByTestId("Green");
    expect(greenButton.tagName).to.be.equal("BUTTON");
    expect(greenButton.classList.contains("nz-is-active")).to.be.false;

    fireEvent.click(greenButton);
    await TestUtils.flushAsyncOperations();
    expect(greenButton.classList.contains("nz-is-active")).to.be.true;
    expect(spyOnCommit.calledOnce).to.be.true;

    const updatedValue = (record.value as PrimitiveValue).value as number;
    expect(updatedValue).to.be.equal(2);
  });

  it("test support for enable/disable button states", async () => {
    const record = TestUtils.createEnumProperty("Test", 0);
    TestUtils.addEnumButtonGroupEditorSpecification(record);

    const renderedComponent = render(<EnumButtonGroupEditor propertyRecord={record} />);

    const blueButton = renderedComponent.getByTestId("Blue");
    expect(blueButton.tagName).to.be.equal("BUTTON");
    expect(blueButton.classList.contains("nz-is-disabled")).to.be.equal(!TestUtils.blueEnumValueIsEnabled);
    TestUtils.toggleBlueEnumValueEnabled();
    renderedComponent.rerender(<EnumButtonGroupEditor propertyRecord={record} />);
    await waitForElement(() => renderedComponent.getByTestId("Blue"));
    expect(blueButton.classList.contains("nz-is-disabled")).to.be.equal(!TestUtils.blueEnumValueIsEnabled);
  });

});
