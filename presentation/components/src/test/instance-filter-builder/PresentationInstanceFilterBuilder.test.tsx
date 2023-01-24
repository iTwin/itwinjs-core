/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyDescription } from "@itwin/appui-abstract";
import { getPropertyFilterOperatorLabel, PropertyFilterRuleGroupOperator, PropertyFilterRuleOperator, UiComponents } from "@itwin/components-react";
import { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, IModelConnection, NoRenderApp } from "@itwin/core-frontend";
import { Descriptor, NavigationPropertyInfo } from "@itwin/presentation-common";
import {
  createTestCategoryDescription, createTestContentDescriptor, createTestECClassInfo, createTestPropertiesContentField, createTestSimpleContentField,
} from "@itwin/presentation-common/lib/cjs/test";
import { Presentation } from "@itwin/presentation-frontend";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { ECClassInfo, getIModelMetadataProvider } from "../../presentation-components/instance-filter-builder/ECMetadataProvider";
import {
  PresentationInstanceFilterBuilder, PresentationInstanceFilterInfo, useFilterBuilderNavigationPropertyEditorContext,
  usePresentationInstanceFilteringProps,
} from "../../presentation-components/instance-filter-builder/PresentationInstanceFilterBuilder";
import { INSTANCE_FILTER_FIELD_SEPARATOR } from "../../presentation-components/instance-filter-builder/Utils";
import { stubRaf } from "./Common";

describe("PresentationInstanceFilter", () => {
  stubRaf();
  const category = createTestCategoryDescription({ name: "root", label: "Root" });
  const classInfo = createTestECClassInfo();
  const propertiesField = createTestPropertiesContentField({
    properties: [{ property: { classInfo, name: "prop1", type: "string" } }],
    name: "prop1Field",
    label: "propertiesField",
    category,
  });
  const propertiesField2 = createTestPropertiesContentField({
    properties: [{ property: { classInfo, name: "prop2", type: "string" } }],
    name: "prop2Field",
    label: "propertiesField2",
    category,
  });
  const propertiesField3 = createTestPropertiesContentField({
    properties: [{ property: { classInfo, name: "prop3", type: "string" } }],
    name: "prop3Field",
    label: "propertiesField3",
    category,
  });
  const descriptor = createTestContentDescriptor({
    selectClasses: [{ selectClassInfo: classInfo, isSelectPolymorphic: false }],
    categories: [category],
    fields: [propertiesField, propertiesField2, propertiesField3],
  });
  const initialFilter: PresentationInstanceFilterInfo = {
    filter: {
      operator: PropertyFilterRuleGroupOperator.And,
      conditions: [{
        field: propertiesField,
        operator: PropertyFilterRuleOperator.IsNull,
        value: undefined,
      },
      {
        field: propertiesField2,
        operator: PropertyFilterRuleOperator.IsNull,
        value: undefined,
      }],
    },
    usedClasses: [classInfo],
  };

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const onCloseEvent = new BeEvent<() => void>();

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

  it("invokes 'onInstanceFilterChanged' with filter", async () => {
    const spy = sinon.spy();
    const { container, getByText, getByDisplayValue } = render(<PresentationInstanceFilterBuilder
      imodel={imodelMock.object}
      descriptor={descriptor}
      onInstanceFilterChanged={spy}
    />);

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

    expect(spy).to.be.calledWith({
      filter: {
        field: propertiesField,
        operator: PropertyFilterRuleOperator.IsNotNull,
        value: undefined,
      },
      usedClasses: [classInfo],
    }
    );
  });

  it("renders with initial filter", async () => {
    const spy = sinon.spy();
    const { container, queryByDisplayValue } = render(<PresentationInstanceFilterBuilder
      imodel={imodelMock.object}
      descriptor={descriptor}
      onInstanceFilterChanged={spy}
      initialFilter={initialFilter}
    />);
    const rules = container.querySelectorAll(".rule-property");
    expect(rules.length).to.be.eq(2);
    const rule1 = queryByDisplayValue(propertiesField.label);
    expect(rule1).to.not.be.null;
    const rule2 = queryByDisplayValue(propertiesField2.label);
    expect(rule2).to.not.be.null;
  });
});

describe("usePresentationInstanceFilteringProps", () => {
  interface HookProps {
    descriptor: Descriptor;
    imodel: IModelConnection;
  }

  const category = createTestCategoryDescription({ name: "root", label: "Root" });
  const baseClass = createTestECClassInfo({ id: "0x1", label: "Base", name: "schema:base" });
  const concreteClass1 = createTestECClassInfo({ id: "0x2", label: "Concrete1", name: "schema:concrete1" });
  const concreteClass2 = createTestECClassInfo({ id: "0x4", label: "Concrete2", name: "schema:concrete2" });
  const derivedClass = createTestECClassInfo({ id: "0x5", label: "Derived", name: "schema:derived" });
  const basePropertiesField = createTestPropertiesContentField({
    properties: [{ property: { classInfo: baseClass, name: "baseProp", type: "string" } }],
    name: "baseField",
    label: "BaseField",
    category,
  });
  const concretePropertiesField1 = createTestPropertiesContentField({
    properties: [{ property: { classInfo: concreteClass1, name: "concreteProp1", type: "string" } }],
    name: "concreteField1",
    label: "ConcreteField1",
    category,
  });
  const concretePropertiesField2 = createTestPropertiesContentField({
    properties: [{ property: { classInfo: concreteClass2, name: "concreteProp2", type: "string" } }],
    name: "concreteField2",
    label: "ConcreteField2",
    category,
  });
  const derivedPropertiesField = createTestPropertiesContentField({
    properties: [{ property: { classInfo: derivedClass, name: "derivedProp", type: "string" } }],
    name: "derivedField",
    label: "DerivedField",
    category,
  });
  const descriptor = createTestContentDescriptor({
    selectClasses: [
      { selectClassInfo: concreteClass1, isSelectPolymorphic: false },
      { selectClassInfo: concreteClass2, isSelectPolymorphic: false },
    ],
    categories: [category],
    fields: [basePropertiesField, concretePropertiesField1, concretePropertiesField2, derivedPropertiesField],
  });

  const onCloseEvent = new BeEvent<() => void>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  let initialProps: HookProps;

  beforeEach(() => {
    imodelMock.setup((x) => x.key).returns(() => "test_imodel");
    imodelMock.setup((x) => x.onClose).returns(() => onCloseEvent);
    initialProps = {
      descriptor,
      imodel: imodelMock.object,
    };
  });

  afterEach(() => {
    onCloseEvent.raiseEvent();
    imodelMock.reset();
  });

  it("initializes class list from descriptor", () => {
    const { result } = renderHook(
      (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.imodel),
      { initialProps });
    expect(result.current.classes).to.have.lengthOf(2).and.to.containSubset([
      concreteClass1,
      concreteClass2,
    ]);
  });

  it("does not duplicate classes when descriptor contains multiple similar select classes", () => {
    initialProps.descriptor = createTestContentDescriptor({
      selectClasses: [
        // in practice these would be different by additional attributes like path to input class
        { selectClassInfo: concreteClass1, isSelectPolymorphic: false },
        { selectClassInfo: concreteClass1, isSelectPolymorphic: false },
      ],
      categories: [category],
      fields: [basePropertiesField],
    });
    const { result } = renderHook(
      (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.imodel),
      { initialProps });
    expect(result.current.classes).to.have.lengthOf(1).and.to.containSubset([
      concreteClass1,
    ]);
  });

  it("updates selected classes when 'onClassSelected' is called", () => {
    const { result } = renderHook(
      (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.imodel),
      { initialProps });
    result.current.onClassSelected(concreteClass1);
    expect(result.current.selectedClasses).to.have.lengthOf(1).and.to.containSubset([
      concreteClass1,
    ]);
  });

  it("updates selected classes when 'onClassDeselected' is called", () => {
    const { result } = renderHook(
      (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.imodel),
      { initialProps });
    result.current.onClassSelected(concreteClass1);
    expect(result.current.selectedClasses).to.have.lengthOf(1).and.to.containSubset([
      concreteClass1,
    ]);
    result.current.onClassDeselected(concreteClass1);
    expect(result.current.selectedClasses).to.be.empty;
  });

  it("does not change selected classes when 'onClassDeselected' is called with not selected class", () => {
    const { result } = renderHook(
      (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.imodel),
      { initialProps });
    result.current.onClassSelected(concreteClass1);
    expect(result.current.selectedClasses).to.have.lengthOf(1).and.to.containSubset([
      concreteClass1,
    ]);
    result.current.onClassDeselected(concreteClass2);
    expect(result.current.selectedClasses).to.have.lengthOf(1).and.to.containSubset([
      concreteClass1,
    ]);
  });

  it("clears selected classes when 'onClearClasses' is called", () => {
    const { result } = renderHook(
      (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.imodel),
      { initialProps });
    result.current.onClassSelected(concreteClass1);
    expect(result.current.selectedClasses).to.have.lengthOf(1).and.to.containSubset([
      concreteClass1,
    ]);
    result.current.onClearClasses();
    expect(result.current.selectedClasses).to.be.empty;
  });

  it("clears selected classes when new descriptor is provided", () => {
    const { result, rerender } = renderHook(
      (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.imodel),
      { initialProps });
    result.current.onClassSelected(concreteClass1);
    expect(result.current.selectedClasses).to.have.lengthOf(1).and.to.containSubset([
      concreteClass1,
    ]);
    const newDescriptor = createTestContentDescriptor({
      selectClasses: [
        { selectClassInfo: concreteClass1, isSelectPolymorphic: false },
      ],
      categories: [category],
      fields: [basePropertiesField],
    });
    // rerender with new descriptor
    rerender({ descriptor: newDescriptor, imodel: initialProps.imodel });

    expect(result.current.selectedClasses).to.be.empty;
  });

  describe("properties filtering", () => {
    beforeEach(() => {
      // stub metadataProvider for test imodel
      const metadataProvider = getIModelMetadataProvider(imodelMock.object);
      sinon.stub(metadataProvider, "getECClassInfo").callsFake(async (id) => {
        switch (id) {
          case baseClass.id:
            return new ECClassInfo(baseClass.id, baseClass.name, baseClass.label, new Set(), new Set([concreteClass1.id, concreteClass2.id, derivedClass.id]));
          case concreteClass1.id:
            return new ECClassInfo(concreteClass1.id, concreteClass1.name, concreteClass1.label, new Set([baseClass.id]), new Set([derivedClass.id]));
          case concreteClass2.id:
            return new ECClassInfo(concreteClass2.id, concreteClass2.name, concreteClass2.label, new Set([baseClass.id]), new Set());
          case derivedClass.id:
            return new ECClassInfo(derivedClass.id, derivedClass.name, derivedClass.label, new Set([baseClass.id, concreteClass1.id]), new Set());
        }
        return undefined;
      });
    });

    afterEach(() => {
      sinon.resetBehavior();
    });

    it("returns properties only of selected class", async () => {
      const { result, waitForValueToChange } = renderHook(
        (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.imodel),
        { initialProps });

      result.current.onClassSelected(concreteClass2);
      await waitForValueToChange(() => result.current);
      expect(result.current.properties).to.have.lengthOf(2);
    });

    it("return all properties when selected class contains all available properties", async () => {
      const testDescriptor = createTestContentDescriptor({
        selectClasses: [
          { selectClassInfo: concreteClass1, isSelectPolymorphic: false },
        ],
        categories: [category],
        fields: [basePropertiesField, concretePropertiesField1],
      });
      const { result, waitForValueToChange } = renderHook(
        (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.imodel),
        { initialProps: { ...initialProps, descriptor: testDescriptor } });

      expect(result.current.properties).to.have.lengthOf(2);
      result.current.onClassSelected(concreteClass1);
      await waitForValueToChange(() => result.current);
      expect(result.current.properties).to.have.lengthOf(2);

    });

    it("selects classes that have selected property", async () => {
      const { result, waitForValueToChange } = renderHook(
        (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.imodel),
        { initialProps });

      const property = result.current.properties.find((prop) => prop.displayLabel === concretePropertiesField2.label);
      result.current.onRulePropertySelected(property!);
      await waitForValueToChange(() => result.current);
      expect(result.current.selectedClasses).to.have.lengthOf(1).and.containSubset([
        concreteClass2,
      ]);
    });

    it("selects all derived classes that have selected property", async () => {
      const { result, waitForValueToChange } = renderHook(
        (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.imodel),
        { initialProps });

      const property = result.current.properties.find((prop) => prop.displayLabel === basePropertiesField.label);
      result.current.onRulePropertySelected(property!);
      await waitForValueToChange(() => result.current);
      expect(result.current.selectedClasses).to.have.lengthOf(2).and.containSubset([
        concreteClass1,
        concreteClass2,
      ]);
    });

    it("does not change selected classes when selected property class is already selected", async () => {
      const { result, waitForValueToChange } = renderHook(
        (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.imodel),
        { initialProps });

      result.current.onClassSelected(concreteClass2);
      await waitForValueToChange(() => result.current);
      expect(result.current.selectedClasses).to.have.lengthOf(1).and.containSubset([
        concreteClass2,
      ]);
      const property = result.current.properties.find((prop) => prop.displayLabel === concretePropertiesField2.label);
      result.current.onRulePropertySelected(property!);
      await waitForValueToChange(() => result.current);
      expect(result.current.selectedClasses).to.have.lengthOf(1).and.containSubset([
        concreteClass2,
      ]);
    });

    it("does not change selected classes when 'onPropertySelected' is invoked with invalid property", () => {
      const { result } = renderHook(
        (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.imodel),
        { initialProps });

      result.current.onRulePropertySelected({ name: "invalidProp", displayLabel: "InvalidProp", typename: "string" });
      expect(result.current.selectedClasses).to.be.empty;
    });
  });
});

describe("useFilterBuilderNavigationPropertyEditorContext", () => {
  interface Props {
    imodel: IModelConnection;
    descriptor: Descriptor;
  }
  const testImodel = {} as IModelConnection;

  it("returns navigation property info", async () => {
    const navigationPropertyInfo: NavigationPropertyInfo = {
      classInfo: { id: "2", label: "Prop Class", name: "TestSchema:PropClass" },
      targetClassInfo: { id: "3", label: "Target Class", name: "TestSchema:TargetClass" },
      isForwardRelationship: true,
      isTargetPolymorphic: true,
    };
    const fieldName = "field_name";
    const testDescriptor = createTestContentDescriptor({
      fields: [
        createTestPropertiesContentField({
          name: fieldName,
          properties: [{
            property: {
              classInfo: { id: "1", label: "Field Class", name: "TestSchema:FieldClass" },
              name: "nav_prop",
              type: "navigation",
              navigationPropertyInfo,
            },
          }],
        }),
      ],
    });
    const propertyDescription: PropertyDescription = {
      displayLabel: "TestProp",
      name: `test_category${INSTANCE_FILTER_FIELD_SEPARATOR}${fieldName}`,
      typename: "navigation",
    };

    const { result } = renderHook(
      ({ imodel, descriptor }: Props) => useFilterBuilderNavigationPropertyEditorContext(imodel, descriptor),
      { initialProps: { imodel: testImodel, descriptor: testDescriptor } }
    );

    const info = await result.current.getNavigationPropertyInfo(propertyDescription);
    expect(info).to.be.deep.eq(navigationPropertyInfo);
  });

  it("returns `undefined` for non properties field", async () => {
    const fieldName = "field_name";
    const testDescriptor = createTestContentDescriptor({
      fields: [createTestSimpleContentField({ name: fieldName })],
    });
    const propertyDescription: PropertyDescription = {
      displayLabel: "TestProp",
      name: `test_category${INSTANCE_FILTER_FIELD_SEPARATOR}${fieldName}`,
      typename: "navigation",
    };

    const { result } = renderHook(
      ({ imodel, descriptor }: Props) => useFilterBuilderNavigationPropertyEditorContext(imodel, descriptor),
      { initialProps: { imodel: testImodel, descriptor: testDescriptor } }
    );

    const info = await result.current.getNavigationPropertyInfo(propertyDescription);
    expect(info).to.be.undefined;
  });
});
