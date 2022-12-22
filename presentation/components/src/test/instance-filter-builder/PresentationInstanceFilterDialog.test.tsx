/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import sinon from "sinon";
import * as moq from "typemoq";
import { getPropertyFilterOperatorLabel, PropertyFilterRuleGroupOperator, PropertyFilterRuleOperator, UiComponents } from "@itwin/components-react";
import { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, IModelConnection, NoRenderApp } from "@itwin/core-frontend";
import {
  createTestCategoryDescription, createTestContentDescriptor, createTestECClassInfo, createTestPropertiesContentField,
} from "@itwin/presentation-common/lib/cjs/test";
import { Presentation } from "@itwin/presentation-frontend";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { ECClassInfo, getIModelMetadataProvider } from "../../presentation-components/instance-filter-builder/ECMetadataProvider";
import {
  PresentationInstanceFilterInfo,
} from "../../presentation-components/instance-filter-builder/PresentationInstanceFilterBuilder";
import { stubRaf } from "./Common";
import { PresentationInstanceFilterDialog } from "../../presentation-components";
import { expect } from "chai";

describe("PresentationInstanceFilterDialog", () => {
  stubRaf();
  const category = createTestCategoryDescription({ name: "root", label: "Root" });
  const classInfo = createTestECClassInfo();
  const propertiesField = createTestPropertiesContentField({
    properties: [{ property: { classInfo, name: "prop1", type: "string" } }],
    name: "prop1Field",
    label: "propertiesField",
    category,
  });
  const descriptor = createTestContentDescriptor({
    selectClasses: [{ selectClassInfo: classInfo, isSelectPolymorphic: false }],
    categories: [category],
    fields: [propertiesField],
  });
  const initialFilter: PresentationInstanceFilterInfo = {
    filter: {
      field: propertiesField,
      operator: PropertyFilterRuleOperator.IsNull,
      value: undefined,
    },
    usedClasses: [classInfo],
  };

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const onCloseEvent = new BeEvent<() => void>();

  beforeEach(() => {
    async function* generator() {
      return;
    }
    imodelMock.setup((x) => x.query(moq.It.isAnyString(), moq.It.isAny(), moq.It.isAny())).returns(() => generator());
    imodelMock.setup((x) => x.key).returns(() => "test_imodel");
    imodelMock.setup((x) => x.onClose).returns(() => onCloseEvent);
    const metadataProvider = getIModelMetadataProvider(imodelMock.object);
    sinon.stub(metadataProvider, "getECClassInfo").callsFake(async () => {
      return new ECClassInfo(classInfo.id, classInfo.name, classInfo.label, new Set(), new Set());
    });
  });

  afterEach(() => {
    onCloseEvent.raiseEvent();
    imodelMock.reset();
  });

  before(async () => {
    await NoRenderApp.startup({
      localization: new EmptyLocalization(),
    });
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

  it("invokes 'onInstanceFilterApplied' with filter", async () => {
    const spy = sinon.spy();
    const { container, getByText, getByDisplayValue } = render(<PresentationInstanceFilterDialog
      imodel={imodelMock.object}
      descriptor={descriptor}
      onInstanceFilterClosed={() => { }}
      onInstanceFilterApplied={spy}
      isOpen={true} />);

    const applyButton = container.querySelector<HTMLInputElement>(".presentation-instance-filter-button-bar .iui-high-visibility:disabled");
    expect(applyButton).to.not.be.null;
    expect(applyButton?.disabled).to.be.true;

    // select property
    const propertySelector = container.querySelector<HTMLInputElement>(".rule-property .iui-input");
    expect(propertySelector).to.not.be.null;
    propertySelector?.focus();
    fireEvent.click(getByText(propertiesField.label));
    // wait until property is selected
    await waitFor(() => getByDisplayValue(propertiesField.label));
    // select operator
    const operatorSelector = container.querySelector<HTMLInputElement>(".rule-operator .iui-select-button");
    expect(operatorSelector).to.not.be.null;
    fireEvent.click(operatorSelector!);
    fireEvent.click(getByText(getPropertyFilterOperatorLabel(PropertyFilterRuleOperator.IsNotNull)));
    // wait until operator is selected
    await waitFor(() => getByText(getPropertyFilterOperatorLabel(PropertyFilterRuleOperator.IsNotNull)));

    expect(applyButton?.disabled).to.be.false;
    if (applyButton)
      fireEvent.click(applyButton);
    expect(spy).to.be.calledOnceWith({
      filter: {
        field: propertiesField,
        operator: PropertyFilterRuleOperator.IsNotNull,
        value: undefined,
      },
      usedClasses: [classInfo],
    });
  });

  it("invokes 'onInstanceFilterApplied' with initial filter", async () => {
    const spy = sinon.spy();
    const { container } = render(<PresentationInstanceFilterDialog
      imodel={imodelMock.object}
      descriptor={descriptor}
      onInstanceFilterClosed={() => { }}
      onInstanceFilterApplied={spy}
      isOpen={true}
      initialFilter={initialFilter} />);

    const applyButton = container.querySelector<HTMLInputElement>(".presentation-instance-filter-button-bar .iui-high-visibility");
    expect(applyButton).to.not.be.null;
    expect(applyButton?.disabled).to.be.false;

    if (applyButton)
      fireEvent.click(applyButton);
    expect(spy).to.be.calledOnceWith(initialFilter);
  });

  it("renders custom title", async () => {
    const spy = sinon.spy();
    const title = "custom title";

    const { getByText } = render(<PresentationInstanceFilterDialog
      imodel={imodelMock.object}
      descriptor={descriptor}
      onInstanceFilterClosed={() => { }}
      title={<div>{title}</div>}
      onInstanceFilterApplied={spy}
      isOpen={true}
      initialFilter={initialFilter} />);

    expect(queryByText(title)).to.not.be.null;

  });

  it("renders filterResultCountRenderer", async () => {
    const spy = sinon.spy();
    const count = "custom count";

    const { getByText } = render(<PresentationInstanceFilterDialog
      imodel={imodelMock.object}
      descriptor={descriptor}
      onInstanceFilterClosed={() => { }}
      filterResultCountRenderer={() => { return <div>{count}</div>; }}
      onInstanceFilterApplied={spy}
      isOpen={true}
      initialFilter={initialFilter} />);

    expect(queryByText(count)).to.not.be.null;

  });

});
