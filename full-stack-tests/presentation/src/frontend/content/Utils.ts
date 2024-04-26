/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { assert } from "@itwin/core-bentley";
import { Content, Descriptor, DisplayValue, Field, NestedContentField, Value } from "@itwin/presentation-common";
import { ECClassHierarchyInfo } from "../../ECClasHierarchy";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { initialize, terminate } from "../../IntegrationTests";

interface ContentTestSuiteParams {
  getDefaultSuiteIModel: () => Promise<IModelConnection>;
  closeSuiteIModel: () => Promise<void>;
}
type ExclusiveContentTestSuiteFunction = (title: string, fn: (params: ContentTestSuiteParams) => void) => void;
interface ContentTestSuiteFunction extends ExclusiveContentTestSuiteFunction {
  only: ExclusiveContentTestSuiteFunction;
  skip: ExclusiveContentTestSuiteFunction;
}
export function createContentTestSuite(): ContentTestSuiteFunction {
  const suiteTitle = "Content";
  const suiteFn = (title: string, fn: (params: ContentTestSuiteParams) => void) => {
    let suiteIModel: IModelConnection;
    const openDefaultSuiteIModel = async () => {
      if (!suiteIModel || !suiteIModel.isOpen) {
        suiteIModel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
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
      await initialize();
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

function cloneFilteredNestedContentField(field: NestedContentField, filterClassInfo: ECClassHierarchyInfo) {
  const clone = field.clone();
  clone.nestedFields = filterNestedContentFieldsByClass(clone.nestedFields, filterClassInfo);
  return clone;
}
function filterNestedContentFieldsByClass(fields: Field[], classInfo: ECClassHierarchyInfo) {
  const filteredFields = new Array<Field>();
  fields.forEach((f) => {
    if (f.isNestedContentField() && f.actualPrimaryClassIds.some((id) => classInfo.id === id || classInfo.derivedClasses.some((info) => info.id === id))) {
      const clone = cloneFilteredNestedContentField(f, classInfo);
      if (clone.nestedFields.length > 0) {
        filteredFields.push(clone);
      }
    } else {
      filteredFields.push(f);
    }
  });
  return filteredFields;
}
export function filterFieldsByClass(fields: Field[], classInfo: ECClassHierarchyInfo) {
  const filteredFields = new Array<Field>();
  fields.forEach((f) => {
    if (f.isNestedContentField()) {
      // always include nested content field if its `actualPrimaryClassIds` contains either id of given class itself or one of its derived class ids
      // note: nested content fields might have more nested fields inside them and these deeply nested fields might not apply for given class - for
      // that we need to clone the field and pick only property fields and nested fields that apply.
      const appliesForGivenClass = f.actualPrimaryClassIds.some((id) => classInfo.id === id || classInfo.derivedClasses.some((info) => info.id === id));
      if (appliesForGivenClass) {
        const clone = cloneFilteredNestedContentField(f, classInfo);
        if (clone.nestedFields.length > 0) {
          filteredFields.push(clone);
        }
      }
    } else if (f.isPropertiesField()) {
      // always include the field is at least one property in the field belongs to either base or derived class of given class
      const appliesForGivenClass = f.properties.some((p) => {
        const propertyClassId = p.property.classInfo.id;
        return (
          propertyClassId === classInfo.id ||
          classInfo.baseClasses.some((info) => info.id === propertyClassId) ||
          classInfo.derivedClasses.some((info) => info.id === propertyClassId)
        );
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
