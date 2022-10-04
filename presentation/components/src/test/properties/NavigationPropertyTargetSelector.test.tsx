/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import { PrimitiveValue, PropertyDescription, PropertyRecord, PropertyValue, PropertyValueFormat } from "@itwin/appui-abstract";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, IModelConnection, NoRenderApp } from "@itwin/core-frontend";
import { Content, LabelDefinition, NavigationPropertyInfo } from "@itwin/presentation-common";
import { createTestContentDescriptor, createTestContentItem } from "@itwin/presentation-common/lib/cjs/test";
import { Presentation } from "@itwin/presentation-frontend";
import { fireEvent, render, waitFor } from "@testing-library/react";
import {
  NavigationPropertyTargetSelector, NavigationPropertyTargetSelectorAttributes, NavigationPropertyTargetSelectorProps,
} from "../../presentation-components/properties/NavigationPropertyTargetSelector";

function createNavigationPropertyDescription(): PropertyDescription {
  return {
    displayLabel: "TestProp",
    name: "test_prop",
    typename: "navigation",
  };
}

function createRecord() {
  return new PropertyRecord({ valueFormat: PropertyValueFormat.Primitive }, createNavigationPropertyDescription());
}

describe("NavigationPropertyTargetSelector", () => {
  const testImodel = {} as IModelConnection;
  const testNavigationPropertyInfo: NavigationPropertyInfo = {
    classInfo: { id: "1", label: "Prop Class", name: "TestSchema:TestClass" },
    isForwardRelationship: true,
    isTargetPolymorphic: true,
    targetClassInfo: { id: "2", label: "Rel Class", name: "TestSchema:RelationshipClass" },
  };
  const testRecord = createRecord();
  const contentItem = createTestContentItem({
    label: LabelDefinition.fromLabelString("TestLabel"),
    primaryKeys: [{ id: "1", className: "TestSchema:TestClass" }],
    displayValues: {},
    values: {},
  });

  beforeEach(async () => {
    await NoRenderApp.startup({
      localization: new EmptyLocalization(),
    });
    await Presentation.initialize();
  });

  afterEach(async () => {
    sinon.restore();
    Presentation.terminate();
    await IModelApp.shutdown();
  });

  it("renders selector", async () => {
    sinon.stub(Presentation.presentation, "getContent").resolves(new Content(createTestContentDescriptor({ fields: [], categories: [] }), [contentItem]));
    const { container, queryByText } = render(
      <NavigationPropertyTargetSelector
        imodel={testImodel}
        getNavigationPropertyInfo={async () => testNavigationPropertyInfo}
        propertyRecord={testRecord}
      />
    );

    const select = await waitFor(() => {
      const element = container.querySelector<HTMLDivElement>(".iui-select-button");
      expect(element).to.not.be.null;
      return element;
    });
    fireEvent.mouseDown(select!);

    expect(await waitFor(() => queryByText(contentItem.label.displayValue))).to.not.be.undefined;
  });

  it("invokes onCommit with selected target", async () => {
    const spy = sinon.spy();
    sinon.stub(Presentation.presentation, "getContent").resolves(new Content(createTestContentDescriptor({ fields: [], categories: [] }), [contentItem]));
    const { container, getByText } = render(
      <NavigationPropertyTargetSelector
        imodel={testImodel}
        getNavigationPropertyInfo={async () => testNavigationPropertyInfo}
        propertyRecord={testRecord}
        onCommit={spy}
      />
    );

    const select = await waitFor(() => {
      const element = container.querySelector<HTMLDivElement>(".iui-select-button");
      expect(element).to.not.be.null;
      return element;
    });
    fireEvent.mouseDown(select!);

    const target = await waitFor(() => getByText(contentItem.label.displayValue));
    fireEvent.click(target);
    expect(spy).to.be.calledOnceWith({
      propertyRecord: testRecord,
      newValue: {
        valueFormat: PropertyValueFormat.Primitive,
        value: contentItem.primaryKeys[0],
        displayValue: contentItem.label.displayValue,
      },
    });
  });

  it("get value from target selector reference", async () => {
    sinon.stub(Presentation.presentation, "getContent").resolves(new Content(createTestContentDescriptor({ fields: [], categories: [] }), [contentItem]));
    const ref = React.createRef<NavigationPropertyTargetSelectorAttributes>();
    const { container, getByText } = render(
      <NavigationPropertyTargetSelector
        ref={ref}
        imodel={testImodel}
        getNavigationPropertyInfo={async () => testNavigationPropertyInfo}
        propertyRecord={testRecord}
      />
    );

    expect((ref.current?.getValue() as PrimitiveValue).value).to.be.undefined;

    const select = await waitFor(() => {
      const element = container.querySelector<HTMLDivElement>(".iui-input-with-icon");
      expect(element).to.not.be.null;
      return element;
    });
    fireEvent.mouseDown(select!);

    const target = await waitFor(() => getByText(contentItem.label.displayValue));
    fireEvent.click(target);

    expect((ref.current?.getValue() as PrimitiveValue).value).to.be.eq(contentItem.primaryKeys[0]);
  });

  it("sets initial value from property record", async () => {
    sinon.stub(Presentation.presentation, "getContent").resolves(new Content(createTestContentDescriptor({ fields: [], categories: [] }), []));
    const propertyDescription = createNavigationPropertyDescription();
    const value = {
      valueFormat: PropertyValueFormat.Primitive,
      value: { id: "1", className: "TestSchema:TargetClass" },
      displayValue: "Target Class Instance",
    };
    const propertyRecord = new PropertyRecord(value as PropertyValue, propertyDescription);

    const initialProps: NavigationPropertyTargetSelectorProps = {
      imodel: testImodel,
      getNavigationPropertyInfo: async () => testNavigationPropertyInfo,
      propertyRecord,
    };
    const { queryByText } = render(<NavigationPropertyTargetSelector {...initialProps} />);

    await waitFor(() => expect(queryByText(value.displayValue)).to.not.be.null);
  });

  it("changes value when new record is passed", async () => {
    sinon.stub(Presentation.presentation, "getContent").resolves(new Content(createTestContentDescriptor({ fields: [], categories: [] }), []));
    const propertyDescription = createNavigationPropertyDescription();
    const value = {
      valueFormat: PropertyValueFormat.Primitive,
      value: { id: "1", className: "TestSchema:TargetClass" },
      displayValue: "Target Class Instance",
    };
    const propertyRecord = new PropertyRecord(value as PropertyValue, propertyDescription);

    const initialProps: NavigationPropertyTargetSelectorProps = {
      imodel: testImodel,
      getNavigationPropertyInfo: async () => testNavigationPropertyInfo,
      propertyRecord,
    };
    const { rerender, queryByText } = render(<NavigationPropertyTargetSelector {...initialProps} />);

    await waitFor(() => expect(queryByText(value.displayValue)).to.not.be.null);
    const newValue = {
      valueFormat: PropertyValueFormat.Primitive,
      value: { id: "2", className: "TestSchema:TargetClass" },
      displayValue: "New Target Class Instance",
    };
    const newPropertyRecord = new PropertyRecord(newValue as PropertyValue, propertyDescription);
    rerender(<NavigationPropertyTargetSelector {...initialProps} propertyRecord={newPropertyRecord} />);
    await waitFor(() => expect(queryByText(newValue.displayValue)).to.not.be.null);
  });
});
