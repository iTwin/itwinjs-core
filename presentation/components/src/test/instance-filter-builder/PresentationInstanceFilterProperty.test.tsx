/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import { UiComponents } from "@itwin/components-react";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import { fireEvent, render } from "@testing-library/react";
import { PresentationInstanceFilterProperty } from "../../presentation-components/instance-filter-builder/PresentationInstanceFilterProperty";
import { createTestInstanceFilterPropertyInfo, stubRaf } from "./Common";

describe("PresentationInstanceFilterProperty", () => {
  stubRaf();
  const className = "TestClassName";
  const schemaName = "TestSchema";

  before(async () => {
    await NoRenderApp.startup();
    await UiComponents.initialize(new EmptyLocalization());
    await Presentation.initialize();
    Element.prototype.scrollIntoView = sinon.stub();
  });

  after(async () => {
    Presentation.terminate();
    UiComponents.terminate();
    await IModelApp.shutdown();
    sinon.restore();
  });

  it("renders with badge", () => {
    const testPropertyInfo = createTestInstanceFilterPropertyInfo({
      className: `${schemaName}:${className}`,
      categoryLabel: "TestCategoryLabel",
    });
    const { container, queryByText } = render(<PresentationInstanceFilterProperty
      instanceFilterPropertyInfo={testPropertyInfo} />);

    expect(queryByText(testPropertyInfo.propertyDescription.displayLabel)).to.not.be.null;
    const propertyBadgeSelector = container.querySelector<HTMLInputElement>(".badge");
    expect(propertyBadgeSelector).to.not.be.null;
    fireEvent.mouseEnter(propertyBadgeSelector!);
    expect(queryByText(className)).to.not.be.null;
    expect(queryByText(schemaName)).to.not.be.null;
  });

  it("renders without badge", () => {
    const TestPropertyInfoWithoutBadge = createTestInstanceFilterPropertyInfo({
      className: `${schemaName}:${className}`,
    });
    const { container, queryByText } = render(<PresentationInstanceFilterProperty
      instanceFilterPropertyInfo={TestPropertyInfoWithoutBadge} />);

    expect(queryByText(TestPropertyInfoWithoutBadge.propertyDescription.displayLabel)).to.not.be.null;
    expect(container.querySelector<HTMLInputElement>(".badge")).to.be.null;
  });
});
