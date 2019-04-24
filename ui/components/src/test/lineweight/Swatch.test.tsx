/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { render, cleanup, fireEvent } from "react-testing-library"; // , waitForElement
import { expect } from "chai";
import sinon from "sinon";
import { LineWeightSwatch } from "../../ui-components/lineweight/Swatch";
import TestUtils from "../TestUtils";
import { ColorDef } from "@bentley/imodeljs-common";

describe("<LineWeightSwatch />", () => {
  const colorDef = ColorDef.from(255, 0, 0, 255);
  const activeWeight = 3;

  afterEach(cleanup);

  it("should render", () => {
    const renderedComponent = render(<LineWeightSwatch colorDef={colorDef} weight={activeWeight} />);
    expect(renderedComponent).not.to.be.undefined;
    const label = renderedComponent.getByText("3");
    expect(label).not.to.be.undefined;
  });

  it("should render with no label", () => {
    const renderedComponent = render(<LineWeightSwatch colorDef={colorDef} weight={activeWeight} hideLabel={true} />);
    expect(renderedComponent).not.to.be.undefined;
    const label = renderedComponent.queryByText("3");
    expect(label).to.be.null;
  });

  it("Fire click event to pick weight", async () => {
    const spyOnPick = sinon.spy();

    const renderedComponent = render(<LineWeightSwatch weight={activeWeight} onClick={spyOnPick} />);
    const weightSwatch = renderedComponent.container.firstChild as HTMLElement;
    expect(weightSwatch).not.to.be.null;
    expect(weightSwatch.tagName).to.be.equal("BUTTON");
    fireEvent.click(weightSwatch);
    await TestUtils.flushAsyncOperations();
    expect(spyOnPick.calledOnce).to.be.true;
  });

});
