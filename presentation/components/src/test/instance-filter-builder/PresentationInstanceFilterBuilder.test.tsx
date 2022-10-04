/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyDescription } from "@itwin/appui-abstract";
import { getPropertyFilterOperatorLabel, PropertyFilterRuleOperator, UiComponents } from "@itwin/components-react";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, IModelConnection, NoRenderApp } from "@itwin/core-frontend";
import { Descriptor, NavigationPropertyInfo } from "@itwin/presentation-common";
import {
  createTestCategoryDescription, createTestContentDescriptor, createTestECClassInfo, createTestPropertiesContentField, createTestPropertyInfo,
  createTestSimpleContentField,
} from "@itwin/presentation-common/lib/cjs/test";
import { Presentation } from "@itwin/presentation-frontend";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { ECClassHierarchyProvider } from "../../presentation-components/instance-filter-builder/ECClassesHierarchy";
import {
  PresentationInstanceFilterBuilder, PresentationInstanceFilterProperty, useFilterBuilderNavigationPropertyEditorContextProps,
  usePresentationInstanceFilteringProps,
} from "../../presentation-components/instance-filter-builder/PresentationInstanceFilterBuilder";
import { InstanceFilterPropertyInfo } from "../../presentation-components/instance-filter-builder/Types";
import { INSTANCE_FILTER_FIELD_SEPARATOR } from "../../presentation-components/instance-filter-builder/Utils";
import { stubRaf } from "./Common";

export const createTestInstanceFilterPropertyInfo = (props?: Partial<InstanceFilterPropertyInfo>) => ({
  sourceClassIds: ["0x1"],
  field: createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo() }], category: createTestCategoryDescription() }),
  propertyDescription: {
    name: "TestName",
    displayLabel: "TestDisplayLabel",
    typename: "string",
  },
  className: props?.className ? props?.className : "testSchema:testClass",
  ...props,
});

describe("PresentationInstanceFilter", () => {
  stubRaf();
  const category = createTestCategoryDescription({ name: "root", label: "Root" });
  const classInfo = createTestECClassInfo();
  const propertiesField = createTestPropertiesContentField({
    properties: [{ property: { classInfo, name: "prop1", type: "string" } }],
    name: "prop1Field",
    category,
  });
  const descriptor = createTestContentDescriptor({
    selectClasses: [{ selectClassInfo: classInfo, isSelectPolymorphic: false }],
    categories: [category],
    fields: [propertiesField],
  });
  const imodelMock = moq.Mock.ofType<IModelConnection>();

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

  beforeEach(() => {
    async function* generator() {
      return;
    }
    imodelMock.setup((x) => x.query(moq.It.isAnyString(), moq.It.isAny(), moq.It.isAny())).returns(() => generator());
  });

  it("invokes 'onInstanceFilterChanged' with filter", async () => {
    const spy = sinon.spy();
    const { container, getByText, getByDisplayValue } = render(<PresentationInstanceFilterBuilder
      imodel={imodelMock.object}
      descriptor={descriptor}
      onInstanceFilterChanged={spy}
    />);
    expect(spy).to.be.calledOnceWith(undefined);
    spy.resetHistory();

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

    expect(spy).to.be.calledOnceWith({
      field: propertiesField,
      operator: PropertyFilterRuleOperator.IsNotNull,
      value: undefined,
    });
  });
});

describe("usePresentationInstanceFilteringProps", () => {
  interface HookProps {
    descriptor: Descriptor;
    classHierarchyProvider?: ECClassHierarchyProvider;
    enableClassFiltering?: boolean;
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

  const initialProps: HookProps = {
    descriptor,
  };

  it("initializes class list from descriptor", () => {
    const { result } = renderHook(
      (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.classHierarchyProvider, props.enableClassFiltering),
      { initialProps });
    expect(result.current.classes).to.have.lengthOf(2).and.to.containSubset([
      concreteClass1,
      concreteClass2,
    ]);
  });

  it("updates selected classes when 'onClassSelected' is called", () => {
    const { result } = renderHook(
      (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.classHierarchyProvider, props.enableClassFiltering),
      { initialProps });
    result.current.onClassSelected(concreteClass1);
    expect(result.current.selectedClasses).to.have.lengthOf(1).and.to.containSubset([
      concreteClass1,
    ]);
  });

  it("updates selected classes when 'onClassDeselected' is called", () => {
    const { result } = renderHook(
      (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.classHierarchyProvider, props.enableClassFiltering),
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
      (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.classHierarchyProvider, props.enableClassFiltering),
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
      (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.classHierarchyProvider, props.enableClassFiltering),
      { initialProps });
    result.current.onClassSelected(concreteClass1);
    expect(result.current.selectedClasses).to.have.lengthOf(1).and.to.containSubset([
      concreteClass1,
    ]);
    result.current.onClearClasses();
    expect(result.current.selectedClasses).to.be.empty;
  });

  describe("properties filtering", () => {
    const classHierarchyProvider = new ECClassHierarchyProvider(
      new Set([baseClass.id, concreteClass1.id, concreteClass2.id, derivedClass.id]),
      new Map([
        [concreteClass1.id, [baseClass.id]],
        [concreteClass2.id, [baseClass.id]],
        [derivedClass.id, [concreteClass1.id, baseClass.id]],
      ]),
      new Map([
        [baseClass.id, [concreteClass1.id, concreteClass2.id, derivedClass.id]],
        [concreteClass1.id, [derivedClass.id]],
      ])
    );

    it("returns properties only of selected class", () => {
      const { result } = renderHook(
        (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.classHierarchyProvider, props.enableClassFiltering),
        { initialProps: { ...initialProps, classHierarchyProvider } });

      result.current.onClassSelected(concreteClass2);
      expect(result.current.properties).to.have.lengthOf(2);
    });

    it("selects classes that have selected property", () => {
      const { result } = renderHook(
        (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.classHierarchyProvider, props.enableClassFiltering),
        { initialProps: { ...initialProps, classHierarchyProvider, enableClassFiltering: true } });

      const property = result.current.properties.find((prop) => prop.displayLabel === concretePropertiesField2.label);
      result.current.onPropertySelected(property!);
      expect(result.current.selectedClasses).to.have.lengthOf(1).and.containSubset([
        concreteClass2,
      ]);
    });

    it("removes selected class that does not have selected property", () => {
      const { result } = renderHook(
        (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.classHierarchyProvider, props.enableClassFiltering),
        { initialProps: { ...initialProps, classHierarchyProvider, enableClassFiltering: true } });

      result.current.onClassSelected(concreteClass1);
      result.current.onClassSelected(concreteClass2);
      expect(result.current.selectedClasses).to.have.lengthOf(2).and.containSubset([
        concreteClass1,
        concreteClass2,
      ]);

      const property = result.current.properties.find((prop) => prop.displayLabel === concretePropertiesField2.label);
      result.current.onPropertySelected(property!);
      expect(result.current.selectedClasses).to.have.lengthOf(1).and.containSubset([
        concreteClass2,
      ]);
    });

    it("selects all derived classes that have selected property", () => {
      const { result } = renderHook(
        (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.classHierarchyProvider, props.enableClassFiltering),
        { initialProps: { ...initialProps, classHierarchyProvider, enableClassFiltering: true } });

      const property = result.current.properties.find((prop) => prop.displayLabel === basePropertiesField.label);
      result.current.onPropertySelected(property!);
      expect(result.current.selectedClasses).to.have.lengthOf(2).and.containSubset([
        concreteClass1,
        concreteClass2,
      ]);
    });

    it("does not change selected classes when selected property class is already selected", () => {
      const { result } = renderHook(
        (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.classHierarchyProvider, props.enableClassFiltering),
        { initialProps: { ...initialProps, classHierarchyProvider, enableClassFiltering: true } });

      result.current.onClassSelected(concreteClass2);
      expect(result.current.selectedClasses).to.have.lengthOf(1).and.containSubset([
        concreteClass2,
      ]);
      const property = result.current.properties.find((prop) => prop.displayLabel === concretePropertiesField2.label);
      result.current.onPropertySelected(property!);
      expect(result.current.selectedClasses).to.have.lengthOf(1).and.containSubset([
        concreteClass2,
      ]);
    });

    it("does not change selected classes when filtering by properties is disabled", () => {
      const { result } = renderHook(
        (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.classHierarchyProvider, props.enableClassFiltering),
        { initialProps: { ...initialProps, classHierarchyProvider, enableClassFiltering: false } });

      const property = result.current.properties.find((prop) => prop.displayLabel === concretePropertiesField2.label);
      result.current.onPropertySelected(property!);
      expect(result.current.selectedClasses).to.be.empty;
    });

    it("does not change selected classes when 'onPropertySelected' is invoked with invalid property", () => {
      const { result } = renderHook(
        (props: HookProps) => usePresentationInstanceFilteringProps(props.descriptor, props.classHierarchyProvider, props.enableClassFiltering),
        { initialProps: { ...initialProps, classHierarchyProvider, enableClassFiltering: true } });

      result.current.onPropertySelected({ name: "invalidProp", displayLabel: "InvalidProp", typename: "string" });
      expect(result.current.selectedClasses).to.be.empty;
    });
  });
});

describe("PresentationInstanceFilterProperty", () => {
  stubRaf();
  const className = "TestClassName";
  const schemaName = "TestSchema";

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

describe("useFilterBuilderNavigationPropertyEditorContextProps", () => {
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
      ({ imodel, descriptor }: Props) => useFilterBuilderNavigationPropertyEditorContextProps(imodel, descriptor),
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
      ({ imodel, descriptor }: Props) => useFilterBuilderNavigationPropertyEditorContextProps(imodel, descriptor),
      { initialProps: { imodel: testImodel, descriptor: testDescriptor } }
    );

    const info = await result.current.getNavigationPropertyInfo(propertyDescription);
    expect(info).to.be.undefined;
  });
});
