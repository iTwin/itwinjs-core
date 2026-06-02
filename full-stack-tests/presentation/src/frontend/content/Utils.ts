/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { assert, Id64, Id64String } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { SchemaView } from "@itwin/ecschema-metadata";
import { Content, Descriptor, DisplayValue, Field, NestedContentField, Value } from "@itwin/presentation-common";
import { TestIModelConnection } from "../../IModelSetupUtils.js";
import { initialize, terminate, testLocalization } from "../../IntegrationTests.js";

interface ContentTestSuiteParams {
  getDefaultSuiteIModel: () => Promise<IModelConnection>;
  closeSuiteIModel: () => Promise<void>;
}
type ExclusiveContentTestSuiteFunction = (title: string, fn: (params: ContentTestSuiteParams) => void) => void;
interface ContentTestSuiteFunction extends ExclusiveContentTestSuiteFunction {
  only: ExclusiveContentTestSuiteFunction;
  skip: ExclusiveContentTestSuiteFunction;
}
export function createContentTestSuite(props?: { skipInitialize?: boolean }): ContentTestSuiteFunction {
  const suiteTitle = "Content";
  const suiteFn = (title: string, fn: (params: ContentTestSuiteParams) => void) => {
    let suiteIModel: IModelConnection;
    const openDefaultSuiteIModel = async () => {
      if (!suiteIModel || !suiteIModel.isOpen) {
        suiteIModel = TestIModelConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
      }
      expect(suiteIModel).is.not.null;
      return suiteIModel;
    };

    const closeSuiteIModel = async () => {
      if (suiteIModel && suiteIModel.isOpen) {
        await suiteIModel.close();
      }
    };

    before(async () => {
      if (!props?.skipInitialize) {
        await initialize({ imodelAppProps: { localization: testLocalization } });
      }
    });

    after(async () => {
      await closeSuiteIModel();
      await terminate();
    });

    describe(title, () => {
      fn({
        getDefaultSuiteIModel: openDefaultSuiteIModel,
        closeSuiteIModel,
      });
    });
  };
  return Object.assign((title: string, fn: (params: ContentTestSuiteParams) => void) => describe(suiteTitle, () => suiteFn(title, fn)), {
    only: (title: string, fn: (params: ContentTestSuiteParams) => void) => describe.only(suiteTitle, () => suiteFn(title, fn)),
    skip: (title: string, fn: (params: ContentTestSuiteParams) => void) => describe.skip(suiteTitle, () => suiteFn(title, fn)),
  });
}
export const describeContentTestSuite = createContentTestSuite();

export type FieldLabels = Array<string | { label: string; nested: FieldLabels }>;
export function getFieldLabels(fields: Descriptor | Field[]): FieldLabels {
  if (fields instanceof Descriptor) {
    fields = fields.fields;
  }

  return fields
    .map((f) => {
      if (f.isNestedContentField()) {
        return { label: f.label, nested: getFieldLabels(f.nestedFields) };
      }
      return f.label;
    })
    .sort((lhs, rhs) => {
      if (typeof lhs === "string" && typeof rhs === "string") {
        return lhs.localeCompare(rhs);
      }
      if (typeof lhs === "string") {
        return -1;
      }
      if (typeof rhs === "string") {
        return 1;
      }
      return lhs.label.localeCompare(rhs.label);
    });
}

function classIdEquals(cls: SchemaView.Class, classId: Id64String) {
  return Id64.fromUint32Pair(cls.ecInstanceId, 0) === classId;
}
function hasBaseClass(derived: SchemaView.Class, baseClassId: Id64String): boolean {
  return !!derived.baseClass && (classIdEquals(derived.baseClass, baseClassId) || hasBaseClass(derived.baseClass, baseClassId));
}
function hasDerivedClass(base: SchemaView.Class, derivedClassId: Id64String): boolean {
  return base.derivedClasses.some((d) => classIdEquals(d, derivedClassId) || hasDerivedClass(d, derivedClassId));
}
function cloneFilteredNestedContentField(field: NestedContentField, predicate: (field: NestedContentField) => boolean) {
  const clone = field.clone();
  clone.nestedFields = filterNestedContentFields(clone.nestedFields, predicate);
  return clone;
}
function filterNestedContentFields(fields: Field[], predicate: (field: NestedContentField) => boolean) {
  const filteredFields = new Array<Field>();
  fields.forEach((f) => {
    if (f.isNestedContentField() && predicate(f)) {
      const clone = cloneFilteredNestedContentField(f, predicate);
      if (clone.nestedFields.length > 0) {
        filteredFields.push(clone);
      }
    } else {
      filteredFields.push(f);
    }
  });
  return filteredFields;
}
export function filterFieldsByClass(fields: Field[], cls: SchemaView.Class) {
  const nestedContentFieldPredicate = (field: NestedContentField) => {
    // always include nested content field if its `actualPrimaryClassIds` contains either id of given class itself or one of its derived class ids
    return field.actualPrimaryClassIds.some((id) => classIdEquals(cls, id) || hasDerivedClass(cls, id));
  };
  const filteredFields = new Array<Field>();
  fields.forEach((f) => {
    if (f.isNestedContentField()) {
      if (nestedContentFieldPredicate(f)) {
        // nested content fields might have more nested fields inside them and these deeply nested fields might not apply for given class - for
        // that we need to clone the field and pick only property fields and nested fields that apply.
        const clone = cloneFilteredNestedContentField(f, nestedContentFieldPredicate);
        if (clone.nestedFields.length > 0) {
          filteredFields.push(clone);
        }
      }
    } else if (f.isPropertiesField()) {
      // always include the field if at least one property in the field belongs to either base or derived class of given class
      const appliesForGivenClass = f.properties.some((p) => {
        const propertyClassId = p.property.classInfo.id;
        return classIdEquals(cls, propertyClassId) || hasDerivedClass(cls, propertyClassId) || hasBaseClass(cls, propertyClassId);
      });
      if (appliesForGivenClass) {
        filteredFields.push(f);
      }
    } else {
      filteredFields.push(f);
    }
  });
  return filteredFields;
}
export function filterFieldsByClassIntersection(fields: Field[], classes: SchemaView.Class[]) {
  const nestedContentFieldPredicate = (field: NestedContentField) => {
    // always include nested content field if its `actualPrimaryClassIds` contains an id of every given class
    return classes.every((cls) => field.actualPrimaryClassIds.some((id) => classIdEquals(cls, id)));
  };
  const filteredFields = new Array<Field>();
  fields.forEach((f) => {
    if (f.isNestedContentField()) {
      if (nestedContentFieldPredicate(f)) {
        // nested content fields might have more nested fields inside them and these deeply nested fields might not apply for given classes - for
        // that we need to clone the field and pick only property fields and nested fields that apply.
        const clone = cloneFilteredNestedContentField(f, nestedContentFieldPredicate);
        if (clone.nestedFields.length > 0) {
          filteredFields.push(clone);
        }
      }
    } else if (f.isPropertiesField()) {
      // always include the field if at least one property in the field belongs to all of the given classes or their base classes
      const appliesForGivenClasses = classes.every((cls) =>
        f.properties.some((p) => {
          const propertyClassId = p.property.classInfo.id;
          return classIdEquals(cls, propertyClassId) || hasBaseClass(cls, propertyClassId);
        }),
      );
      if (appliesForGivenClasses) {
        filteredFields.push(f);
      }
    } else {
      filteredFields.push(f);
    }
  });
  return filteredFields;
}

export function getDisplayValue(content: Content, fieldsPath: Field[]) {
  let { values, displayValues } = content.contentSet[0];
  for (let i = 0; i < fieldsPath.length - 1; ++i) {
    const currField = fieldsPath[i];
    if (currField.isNestedContentField()) {
      const currentValue = values[currField.name];
      assert(Value.isNestedContent(currentValue));
      expect(currentValue.length).to.eq(1);
      const nestedContentItem = currentValue[0];
      values = nestedContentItem.values;
      displayValues = nestedContentItem.displayValues;
      continue;
    }
    if (currField.isPropertiesField() && currField.isStructPropertiesField()) {
      const currentValue = values[currField.name];
      const currentDisplayValue = displayValues[currField.name];
      assert(Value.isMap(currentValue) && DisplayValue.isMap(currentDisplayValue));
      values = currentValue;
      displayValues = currentDisplayValue;
      continue;
    }
    throw new Error(
      `Failed to find a value for field "${currField.name} at path [${fieldsPath
        .slice(0, i)
        .map((f) => f.name)
        .join(", ")}]. Current values: ${JSON.stringify(values)}"`,
    );
  }
  return displayValues[fieldsPath[fieldsPath.length - 1].name];
}
