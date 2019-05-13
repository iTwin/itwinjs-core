/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { render, cleanup, fireEvent, waitForElement } from "react-testing-library";
import { expect } from "chai";
import sinon from "sinon";
import { WeightEditor } from "../../ui-components/editors/WeightEditor";
import { PropertyUpdatedArgs } from "../../ui-components/editors/EditorContainer";
import TestUtils from "../TestUtils";
import { PrimitiveValue } from "@bentley/imodeljs-frontend";

describe("<WeightEditor />", () => {
  afterEach(cleanup);

  it("should render", () => {
    const renderedComponent = render(<WeightEditor />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("button press should open popup and allow weight selection", async () => {
    const weight = 3;
    const firstWeightValue = 1;
    const record = TestUtils.createWeightProperty("Test", weight);

    const originalValue = (record.value as PrimitiveValue).value as number;
    expect(originalValue).to.be.equal(weight);

    const spyOnCommit = sinon.spy();
    function handleCommit(commit: PropertyUpdatedArgs): void {
      const newValue = (commit.newValue as PrimitiveValue).value as number;
      expect(newValue).to.be.equal(firstWeightValue);
      spyOnCommit();
    }

    const renderedComponent = render(<WeightEditor propertyRecord={record} onCommit={handleCommit} />);
    const pickerButton = renderedComponent.getByTestId("components-weightpicker-button");
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    fireEvent.click(pickerButton);

    // ====== Example of how to see contents of portal <Popup> component ==========
    // const portalDiv = await waitForElement(() => renderedComponent.getByTestId("core-popup"));
    // expect(portalDiv).not.to.be.undefined;
    // tslint:disable-next-line:no-console
    // console.log(portalDiv.outerHTML);
    // =================================

    const popupDiv = await waitForElement(() => renderedComponent.getByTestId("components-weightpicker-popup-lines"));
    // renderedComponent.debug();  // show content of portal
    expect(popupDiv).not.to.be.undefined;
    if (popupDiv) {
      const firstWeightButton = popupDiv.firstChild as HTMLElement;
      expect(firstWeightButton).not.to.be.undefined;
      fireEvent.click(firstWeightButton);

      // wait for async processing done in WeightEditor._onLineWeightPick method
      await TestUtils.flushAsyncOperations();
      expect(spyOnCommit).to.be.calledOnce;
    }
  });

});
