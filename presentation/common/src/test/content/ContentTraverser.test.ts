/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Content } from "../../presentation-common/content/Content";
import {
  addFieldHierarchy,
  combineFieldNames,
  createFieldHierarchies,
  FIELD_NAMES_SEPARATOR,
  FieldHierarchy,
  IContentVisitor,
  parseCombinedFieldNames,
  ProcessFieldHierarchiesProps,
  ProcessMergedValueProps,
  ProcessPrimitiveValueProps,
  StartArrayProps,
  StartCategoryProps,
  StartContentProps,
  StartFieldProps,
  StartItemProps,
  StartStructProps,
  traverseContent,
  traverseContentItem,
  traverseFieldHierarchy,
} from "../../presentation-common/content/ContentTraverser";
import { PropertyValueFormat } from "../../presentation-common/content/TypeDescription";
import {
  createTestCategoryDescription,
  createTestContentDescriptor,
  createTestContentItem,
  createTestNestedContentField,
  createTestSimpleContentField,
} from "../_helpers/Content";
import { createTestECInstanceKey } from "../_helpers/EC";
import { NestedContentValue } from "../../presentation-common";

describe("ContentTraverser", () => {
  class TestContentVisitor implements IContentVisitor {
    public startContent(_props: StartContentProps): boolean {
      return true;
    }
    public finishContent(): void {}

    public processFieldHierarchies(_props: ProcessFieldHierarchiesProps): void {}

    public startItem(_props: StartItemProps): boolean {
      return true;
    }
    public finishItem(): void {}

    public startCategory(_props: StartCategoryProps): boolean {
      return true;
    }
    public finishCategory(): void {}

    public startField(_props: StartFieldProps): boolean {
      return true;
    }
    public finishField(): void {}

    public startStruct(_props: StartStructProps): boolean {
      return true;
    }
    public finishStruct(): void {}

    public startArray(_props: StartArrayProps): boolean {
      return true;
    }
    public finishArray(): void {}

    public processMergedValue(_props: ProcessMergedValueProps): void {}
    public processPrimitiveValue(_props: ProcessPrimitiveValueProps): void {}
  }
  let visitor: TestContentVisitor;

  beforeEach(() => {
    visitor = new TestContentVisitor();
  });

  describe("traverseFieldHierarchy", () => {
    it("doesn't dive into child fields when callback returns `false`", () => {
      const hierarchy: FieldHierarchy = {
        field: createTestSimpleContentField(),
        childFields: [
          {
            field: createTestSimpleContentField(),
            childFields: [],
          },
        ],
      };
      const cb = sinon.stub().returns(false);
      traverseFieldHierarchy(hierarchy, cb);
      expect(cb).to.be.calledOnce;
    });

    it("dives into child fields when callback returns `true`", () => {
      const hierarchy: FieldHierarchy = {
        field: createTestSimpleContentField(),
        childFields: [
          {
            field: createTestSimpleContentField(),
            childFields: [],
          },
        ],
      };
      const cb = sinon.stub().returns(true);
      traverseFieldHierarchy(hierarchy, cb);
      expect(cb).to.be.calledTwice;
    });
  });

  describe("traverseContent", () => {
    it("doesn't process content if `visitor.startContent` returns `false`", () => {
      sinon.stub(visitor, "startContent").returns(false);
      const spies = [sinon.spy(visitor, "processFieldHierarchies"), sinon.spy(visitor, "startItem"), sinon.spy(visitor, "finishContent")];
      const content = new Content(createTestContentDescriptor({ fields: [createTestSimpleContentField()] }), [
        createTestContentItem({ values: {}, displayValues: {} }),
      ]);
      traverseContent(visitor, content);
      spies.forEach((spy) => expect(spy).to.not.be.called);
    });

    it("processes content if `visitor.startContent` returns `true`", () => {
      sinon.stub(visitor, "startContent").returns(true);
      const spies = [sinon.spy(visitor, "processFieldHierarchies"), sinon.spy(visitor, "startItem"), sinon.spy(visitor, "finishContent")];
      const content = new Content(createTestContentDescriptor({ fields: [createTestSimpleContentField()] }), [
        createTestContentItem({ values: {}, displayValues: {} }),
      ]);
      traverseContent(visitor, content);
      spies.forEach((spy) => expect(spy).to.be.calledOnce);
    });
  });

  describe("traverseContentItem", () => {
    it("doesn't process content if `visitor.startContent` returns `false`", () => {
      sinon.stub(visitor, "startContent").returns(false);
      const spies = [sinon.spy(visitor, "processFieldHierarchies"), sinon.spy(visitor, "startItem"), sinon.spy(visitor, "finishContent")];
      const descriptor = createTestContentDescriptor({ fields: [createTestSimpleContentField()] });
      const item = createTestContentItem({ values: {}, displayValues: {} });
      traverseContentItem(visitor, descriptor, item);
      spies.forEach((spy) => expect(spy).to.not.be.called);
    });

    it("processes content if `visitor.startContent` returns `true`", () => {
      sinon.stub(visitor, "startContent").returns(true);
      const spies = [sinon.spy(visitor, "processFieldHierarchies"), sinon.spy(visitor, "startItem"), sinon.spy(visitor, "finishContent")];
      const descriptor = createTestContentDescriptor({ fields: [createTestSimpleContentField()] });
      const item = createTestContentItem({ values: {}, displayValues: {} });
      traverseContentItem(visitor, descriptor, item);
      spies.forEach((spy) => expect(spy).to.be.calledOnce);
    });

    it("doesn't process content item if `visitor.startItem` returns `false`", () => {
      sinon.stub(visitor, "startItem").returns(false);
      const spies = [sinon.spy(visitor, "startField"), sinon.spy(visitor, "finishItem")];
      const descriptor = createTestContentDescriptor({ fields: [createTestSimpleContentField()] });
      const item = createTestContentItem({ values: {}, displayValues: {} });
      traverseContentItem(visitor, descriptor, item);
      spies.forEach((spy) => expect(spy).to.not.be.called);
    });

    it("processes content item if `visitor.startItem` returns `true`", () => {
      sinon.stub(visitor, "startItem").returns(true);
      const spies = [sinon.spy(visitor, "startField"), sinon.spy(visitor, "finishItem")];
      const descriptor = createTestContentDescriptor({ fields: [createTestSimpleContentField()] });
      const item = createTestContentItem({ values: {}, displayValues: {} });
      traverseContentItem(visitor, descriptor, item);
      spies.forEach((spy) => expect(spy).to.be.calledOnce);
    });

    it("doesn't process content field if `visitor.startCategory` returns `false`", () => {
      sinon.stub(visitor, "startCategory").returns(false);
      const spies = [sinon.spy(visitor, "startField"), sinon.spy(visitor, "processPrimitiveValue"), sinon.spy(visitor, "finishField")];
      const descriptor = createTestContentDescriptor({ fields: [createTestSimpleContentField()] });
      const item = createTestContentItem({ values: {}, displayValues: {} });
      traverseContentItem(visitor, descriptor, item);
      spies.forEach((spy) => expect(spy).to.not.be.called);
    });

    it("doesn't process content field if `visitor.startCategory` returns `false` for nested category", () => {
      sinon.stub(visitor, "startCategory").onFirstCall().returns(true).onSecondCall().returns(false);
      const finishCategorySpy = sinon.spy(visitor, "finishCategory");
      const spies = [sinon.spy(visitor, "startField"), sinon.spy(visitor, "processPrimitiveValue"), sinon.spy(visitor, "finishField")];
      const parentCategory = createTestCategoryDescription({ name: "parent" });
      const childCategory = createTestCategoryDescription({ name: "child", parent: parentCategory });
      const descriptor = createTestContentDescriptor({
        fields: [createTestSimpleContentField({ category: childCategory })],
        categories: [parentCategory, childCategory],
      });
      const item = createTestContentItem({ values: {}, displayValues: {} });
      traverseContentItem(visitor, descriptor, item);
      spies.forEach((spy) => expect(spy).to.not.be.called);
      expect(finishCategorySpy).to.be.calledOnce;
    });

    it("processes content field if `visitor.startCategory` returns `true`", () => {
      sinon.stub(visitor, "startCategory").returns(true);
      const spies = [sinon.spy(visitor, "startField"), sinon.spy(visitor, "processPrimitiveValue"), sinon.spy(visitor, "finishField")];
      const descriptor = createTestContentDescriptor({ fields: [createTestSimpleContentField()] });
      const item = createTestContentItem({ values: {}, displayValues: {} });
      traverseContentItem(visitor, descriptor, item);
      spies.forEach((spy) => expect(spy).to.be.called);
    });

    it("doesn't process content field if `visitor.startField` returns `false`", () => {
      sinon.stub(visitor, "startField").returns(false);
      const spies = [sinon.spy(visitor, "processPrimitiveValue"), sinon.spy(visitor, "finishField")];
      const descriptor = createTestContentDescriptor({ fields: [createTestSimpleContentField()] });
      const item = createTestContentItem({ values: {}, displayValues: {} });
      traverseContentItem(visitor, descriptor, item);
      spies.forEach((spy) => expect(spy).to.not.be.called);
    });

    it("processes content field if `visitor.startField` returns `true`", () => {
      sinon.stub(visitor, "startField").returns(true);
      const spies = [sinon.spy(visitor, "processPrimitiveValue"), sinon.spy(visitor, "finishField")];
      const descriptor = createTestContentDescriptor({ fields: [createTestSimpleContentField()] });
      const item = createTestContentItem({ values: {}, displayValues: {} });
      traverseContentItem(visitor, descriptor, item);
      spies.forEach((spy) => expect(spy).to.be.calledOnce);
    });

    it("doesn't process array value if `visitor.startArray` returns `false`", () => {
      sinon.stub(visitor, "startArray").returns(false);
      const spies = [sinon.spy(visitor, "processPrimitiveValue"), sinon.spy(visitor, "finishArray")];
      const primitiveField = createTestSimpleContentField();
      const arrayField = createTestSimpleContentField({
        type: {
          valueFormat: PropertyValueFormat.Array,
          typeName: `${primitiveField.type.typeName}[]`,
          memberType: primitiveField.type,
        },
      });
      const descriptor = createTestContentDescriptor({ fields: [arrayField] });
      const item = createTestContentItem({
        values: {
          [arrayField.name]: ["value1", "value2"],
        },
        displayValues: {
          [arrayField.name]: ["display value 1", "display value 2"],
        },
      });
      traverseContentItem(visitor, descriptor, item);
      spies.forEach((spy) => expect(spy).to.not.be.called);
    });

    it("processes array value if `visitor.startArray` returns `true`", () => {
      sinon.stub(visitor, "startArray").returns(true);
      const spies = [sinon.spy(visitor, "processPrimitiveValue"), sinon.spy(visitor, "finishArray")];
      const primitiveField = createTestSimpleContentField();
      const arrayField = createTestSimpleContentField({
        type: {
          valueFormat: PropertyValueFormat.Array,
          typeName: `${primitiveField.type.typeName}[]`,
          memberType: primitiveField.type,
        },
      });
      const descriptor = createTestContentDescriptor({ fields: [arrayField] });
      const item = createTestContentItem({
        values: {
          [arrayField.name]: ["value"],
        },
        displayValues: {
          [arrayField.name]: ["display value"],
        },
      });
      traverseContentItem(visitor, descriptor, item);
      spies.forEach((spy) => expect(spy).to.be.called);
    });

    it("doesn't process struct value if `visitor.startStruct` returns `false`", () => {
      sinon.stub(visitor, "startStruct").returns(false);
      const spies = [sinon.spy(visitor, "processPrimitiveValue"), sinon.spy(visitor, "finishStruct")];
      const memberField = createTestSimpleContentField();
      const structField = createTestSimpleContentField({
        type: {
          valueFormat: PropertyValueFormat.Struct,
          typeName: `TestStruct`,
          members: [
            {
              name: "MyProp",
              label: "My Property",
              type: memberField.type,
            },
          ],
        },
      });
      const descriptor = createTestContentDescriptor({ fields: [structField] });
      const item = createTestContentItem({
        values: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          [structField.name]: { MyProp: "value" },
        },
        displayValues: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          [structField.name]: { MyProp: "display value" },
        },
      });
      traverseContentItem(visitor, descriptor, item);
      spies.forEach((spy) => expect(spy).to.not.be.called);
    });

    it("process struct value if `visitor.startStruct` returns `true`", () => {
      sinon.stub(visitor, "startStruct").returns(true);
      const spies = [sinon.spy(visitor, "processPrimitiveValue"), sinon.spy(visitor, "finishStruct")];
      const memberField = createTestSimpleContentField();
      const structField = createTestSimpleContentField({
        type: {
          valueFormat: PropertyValueFormat.Struct,
          typeName: `TestStruct`,
          members: [
            {
              name: "MyProp",
              label: "My Property",
              type: memberField.type,
            },
          ],
        },
      });
      const descriptor = createTestContentDescriptor({ fields: [structField] });
      const item = createTestContentItem({
        values: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          [structField.name]: { MyProp: "value" },
        },
        displayValues: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          [structField.name]: { MyProp: "display value" },
        },
      });
      traverseContentItem(visitor, descriptor, item);
      spies.forEach((spy) => expect(spy).to.be.called);
    });

    it("processes merged primitive value", () => {
      const spy = sinon.spy(visitor, "processMergedValue");
      const field = createTestSimpleContentField();
      const descriptor = createTestContentDescriptor({ fields: [field] });
      const item = createTestContentItem({ values: {}, displayValues: {}, mergedFieldNames: [field.name] });
      traverseContentItem(visitor, descriptor, item);
      expect(spy).to.be.calledOnceWith({
        requestedField: field,
        mergedField: field,
        parentFieldName: undefined,
      });
    });

    it("processes primitive value nested under merged nested content item", () => {
      const spy = sinon.spy(visitor, "processMergedValue");
      const primitiveField = createTestSimpleContentField();
      const parentField = createTestNestedContentField({ nestedFields: [primitiveField] });
      const descriptor = createTestContentDescriptor({ fields: [parentField] });
      const item = createTestContentItem({ values: {}, displayValues: {}, mergedFieldNames: [parentField.name] });
      traverseContentItem(visitor, descriptor, item);
      expect(spy).to.be.calledOnceWith({
        requestedField: primitiveField,
        mergedField: parentField,
        parentFieldName: undefined,
      });
    });

    it("doesn't process empty nested content item", () => {
      const startArraySpy = sinon.spy(visitor, "startArray");
      const processPrimitiveValueSpy = sinon.spy(visitor, "processPrimitiveValue");
      const category = createTestCategoryDescription();
      const primitiveField = createTestSimpleContentField({ category });
      const parentField = createTestNestedContentField({ nestedFields: [primitiveField], category });
      const descriptor = createTestContentDescriptor({ fields: [parentField], categories: [category] });
      const item = createTestContentItem({
        values: {
          [parentField.name]: [],
        },
        displayValues: {
          [parentField.name]: [],
        },
      });
      traverseContentItem(visitor, descriptor, item);

      expect(startArraySpy).to.not.be.called;
      expect(processPrimitiveValueSpy).to.not.be.called;
    });

    it("processes primitive value nested under nested content item as array value", () => {
      const startArraySpy = sinon.spy(visitor, "startArray");
      const finishArraySpy = sinon.spy(visitor, "finishArray");
      const processPrimitiveValueSpy = sinon.spy(visitor, "processPrimitiveValue");
      const primitiveField = createTestSimpleContentField();
      const parentField = createTestNestedContentField({ nestedFields: [primitiveField] });
      const descriptor = createTestContentDescriptor({ fields: [parentField] });
      const item = createTestContentItem({
        values: {
          [parentField.name]: [
            {
              primaryKeys: [createTestECInstanceKey()],
              values: {
                [primitiveField.name]: "value1",
              },
              displayValues: {
                [primitiveField.name]: "display value 1",
              },
              mergedFieldNames: [],
            },
            {
              primaryKeys: [createTestECInstanceKey()],
              values: {
                [primitiveField.name]: "value2",
              },
              displayValues: {
                [primitiveField.name]: "display value 2",
              },
              mergedFieldNames: [],
            },
          ],
        },
        displayValues: {
          [parentField.name]: undefined,
        },
      });
      traverseContentItem(visitor, descriptor, item);

      expect(startArraySpy).to.be.calledOnce;
      expect(startArraySpy.firstCall.firstArg).to.containSubset({
        hierarchy: {
          field: {
            name: primitiveField.name,
          },
        },
        valueType: {
          valueFormat: PropertyValueFormat.Array,
          typeName: `${primitiveField.type.typeName}[]`,
          memberType: primitiveField.type,
        },
        parentFieldName: parentField.name,
      });
      expect(processPrimitiveValueSpy).to.be.calledTwice;
      expect(processPrimitiveValueSpy.firstCall.firstArg).to.containSubset({
        field: {
          name: primitiveField.name,
        },
        valueType: primitiveField.type,
        parentFieldName: parentField.name,
        rawValue: "value1",
        displayValue: "display value 1",
      });
      expect(processPrimitiveValueSpy.secondCall.firstArg).to.containSubset({
        field: {
          name: primitiveField.name,
        },
        valueType: primitiveField.type,
        parentFieldName: parentField.name,
        rawValue: "value2",
        displayValue: "display value 2",
      });
      expect(finishArraySpy).to.be.calledOnce;
    });

    it("processes nested content item as struct array value", () => {
      const startArraySpy = sinon.spy(visitor, "startArray");
      const finishArraySpy = sinon.spy(visitor, "finishArray");
      const startStructSpy = sinon.spy(visitor, "startStruct");
      const finishStructSpy = sinon.spy(visitor, "finishStruct");
      const processPrimitiveValueSpy = sinon.spy(visitor, "processPrimitiveValue");
      const category = createTestCategoryDescription();
      const primitiveField1 = createTestSimpleContentField({ name: "primitive1", category });
      const primitiveField2 = createTestSimpleContentField({ name: "primitive2", category });
      const parentField = createTestNestedContentField({ nestedFields: [primitiveField1, primitiveField2], category });
      const descriptor = createTestContentDescriptor({ fields: [parentField], categories: [category] });
      const item = createTestContentItem({
        values: {
          [parentField.name]: [
            {
              primaryKeys: [createTestECInstanceKey()],
              values: {
                [primitiveField1.name]: "value11",
                [primitiveField2.name]: "value12",
              },
              displayValues: {
                [primitiveField1.name]: "display value 11",
                [primitiveField2.name]: "display value 12",
              },
              mergedFieldNames: [],
            },
            {
              primaryKeys: [createTestECInstanceKey()],
              values: {
                [primitiveField1.name]: "value21",
                [primitiveField2.name]: "value22",
              },
              displayValues: {
                [primitiveField1.name]: "display value 21",
                [primitiveField2.name]: "display value 22",
              },
              mergedFieldNames: [],
            },
          ],
        },
        displayValues: {
          [parentField.name]: undefined,
        },
      });
      traverseContentItem(visitor, descriptor, item);

      expect(startArraySpy).to.be.calledOnce;
      expect(startArraySpy.firstCall.firstArg).to.containSubset({
        hierarchy: {
          field: {
            name: parentField.name,
          },
          childFields: [
            {
              field: { name: primitiveField1.name },
            },
            {
              field: { name: primitiveField2.name },
            },
          ],
        },
        valueType: {
          valueFormat: PropertyValueFormat.Array,
          typeName: `${parentField.type.typeName}[]`,
          memberType: {
            valueFormat: PropertyValueFormat.Struct,
            typeName: parentField.type.typeName,
            members: [
              {
                name: primitiveField1.name,
              },
              {
                name: primitiveField2.name,
              },
            ],
          },
        },
        parentFieldName: undefined,
      });
      expect(startStructSpy).to.be.calledTwice;
      startStructSpy.getCalls().forEach((call) =>
        expect(call.firstArg).to.containSubset({
          hierarchy: {
            field: {
              name: parentField.name,
            },
            childFields: [
              {
                field: { name: primitiveField1.name },
              },
              {
                field: { name: primitiveField2.name },
              },
            ],
          },
          valueType: {
            valueFormat: PropertyValueFormat.Struct,
            typeName: parentField.type.typeName,
            members: [
              {
                name: primitiveField1.name,
              },
              {
                name: primitiveField2.name,
              },
            ],
          },
          parentFieldName: undefined,
        }),
      );
      expect(processPrimitiveValueSpy.callCount).to.eq(4);
      expect(processPrimitiveValueSpy.getCall(0).firstArg).to.containSubset({
        field: {
          name: primitiveField1.name,
        },
        valueType: primitiveField1.type,
        parentFieldName: parentField.name,
        rawValue: "value11",
        displayValue: "display value 11",
      });
      expect(processPrimitiveValueSpy.getCall(1).firstArg).to.containSubset({
        field: {
          name: primitiveField2.name,
        },
        valueType: primitiveField2.type,
        parentFieldName: parentField.name,
        rawValue: "value12",
        displayValue: "display value 12",
      });
      expect(processPrimitiveValueSpy.getCall(2).firstArg).to.containSubset({
        field: {
          name: primitiveField1.name,
        },
        valueType: primitiveField1.type,
        parentFieldName: parentField.name,
        rawValue: "value21",
        displayValue: "display value 21",
      });
      expect(processPrimitiveValueSpy.getCall(3).firstArg).to.containSubset({
        field: {
          name: primitiveField2.name,
        },
        valueType: primitiveField2.type,
        parentFieldName: parentField.name,
        rawValue: "value22",
        displayValue: "display value 22",
      });
      expect(finishStructSpy).to.be.calledTwice;
      expect(finishArraySpy).to.be.calledOnce;
    });

    it("processes deeply nested primitive value as array value", () => {
      const startArraySpy = sinon.spy(visitor, "startArray");
      const finishArraySpy = sinon.spy(visitor, "finishArray");
      const processPrimitiveValueSpy = sinon.spy(visitor, "processPrimitiveValue");
      const category1 = createTestCategoryDescription();
      const category2 = createTestCategoryDescription();
      const primitiveField = createTestSimpleContentField({ name: "primitive", category: category1 });
      const middleField = createTestNestedContentField({ nestedFields: [primitiveField], category: category2 });
      const parentField = createTestNestedContentField({ nestedFields: [middleField], category: category2 });
      const descriptor = createTestContentDescriptor({ fields: [parentField], categories: [category1, category2] });
      const item = createTestContentItem({
        values: {
          [parentField.name]: [
            {
              primaryKeys: [createTestECInstanceKey()],
              values: {
                [middleField.name]: [
                  {
                    primaryKeys: [createTestECInstanceKey()],
                    values: {
                      [primitiveField.name]: "value1",
                    },
                    displayValues: {
                      [primitiveField.name]: "display value 1",
                    },
                    mergedFieldNames: [],
                  },
                ],
              },
              displayValues: {
                [middleField.name]: undefined,
              },
              mergedFieldNames: [],
            },
            {
              primaryKeys: [createTestECInstanceKey()],
              values: {
                [middleField.name]: [
                  {
                    primaryKeys: [createTestECInstanceKey()],
                    values: {
                      [primitiveField.name]: "value2",
                    },
                    displayValues: {
                      [primitiveField.name]: "display value 2",
                    },
                    mergedFieldNames: [],
                  },
                ],
              },
              displayValues: {
                [middleField.name]: undefined,
              },
              mergedFieldNames: [],
            },
          ],
        },
        displayValues: {
          [parentField.name]: undefined,
        },
      });
      traverseContentItem(visitor, descriptor, item);

      expect(startArraySpy).to.be.calledOnce;
      expect(startArraySpy.firstCall.firstArg).to.containSubset({
        hierarchy: {
          field: { name: primitiveField.name },
          childFields: [],
        },
        valueType: {
          valueFormat: PropertyValueFormat.Array,
          typeName: `${primitiveField.type.typeName}[]`,
          memberType: {
            valueFormat: PropertyValueFormat.Primitive,
            typeName: primitiveField.type.typeName,
          },
        },
        parentFieldName: `${parentField.name}${FIELD_NAMES_SEPARATOR}${middleField.name}`,
      });
      expect(processPrimitiveValueSpy.callCount).to.eq(2);
      expect(processPrimitiveValueSpy.getCall(0).firstArg).to.containSubset({
        field: {
          name: primitiveField.name,
        },
        valueType: primitiveField.type,
        parentFieldName: `${parentField.name}${FIELD_NAMES_SEPARATOR}${middleField.name}`,
        rawValue: "value1",
        displayValue: "display value 1",
      });
      expect(processPrimitiveValueSpy.getCall(1).firstArg).to.containSubset({
        field: {
          name: primitiveField.name,
        },
        valueType: primitiveField.type,
        parentFieldName: `${parentField.name}${FIELD_NAMES_SEPARATOR}${middleField.name}`,
        rawValue: "value2",
        displayValue: "display value 2",
      });
      expect(finishArraySpy).to.be.calledOnce;
    });

    it("processes deeply nested content item as struct array value", () => {
      const startArraySpy = sinon.spy(visitor, "startArray");
      const finishArraySpy = sinon.spy(visitor, "finishArray");
      const startStructSpy = sinon.spy(visitor, "startStruct");
      const finishStructSpy = sinon.spy(visitor, "finishStruct");
      const processPrimitiveValueSpy = sinon.spy(visitor, "processPrimitiveValue");
      const category1 = createTestCategoryDescription();
      const category2 = createTestCategoryDescription();
      const primitiveField = createTestSimpleContentField({ name: "primitive", category: category1 });
      const middleField = createTestNestedContentField({ nestedFields: [primitiveField], category: category1 });
      const parentField = createTestNestedContentField({ nestedFields: [middleField], category: category2 });
      const descriptor = createTestContentDescriptor({ fields: [parentField], categories: [category1, category2] });
      const item = createTestContentItem({
        values: {
          [parentField.name]: [
            {
              primaryKeys: [createTestECInstanceKey()],
              values: {
                [middleField.name]: [
                  {
                    primaryKeys: [createTestECInstanceKey()],
                    values: {
                      [primitiveField.name]: "value1",
                    },
                    displayValues: {
                      [primitiveField.name]: "display value 1",
                    },
                    mergedFieldNames: [],
                  },
                ],
              },
              displayValues: {
                [middleField.name]: undefined,
              },
              mergedFieldNames: [],
            },
            {
              primaryKeys: [createTestECInstanceKey()],
              values: {
                [middleField.name]: [
                  {
                    primaryKeys: [createTestECInstanceKey()],
                    values: {
                      [primitiveField.name]: "value2",
                    },
                    displayValues: {
                      [primitiveField.name]: "display value 2",
                    },
                    mergedFieldNames: [],
                  },
                ],
              },
              displayValues: {
                [middleField.name]: undefined,
              },
              mergedFieldNames: [],
            },
          ],
        },
        displayValues: {
          [parentField.name]: undefined,
        },
      });
      traverseContentItem(visitor, descriptor, item);

      expect(startArraySpy).to.be.calledOnce;
      expect(startArraySpy.firstCall.firstArg).to.containSubset({
        hierarchy: {
          field: { name: middleField.name },
          childFields: [
            {
              field: { name: primitiveField.name },
            },
          ],
        },
        valueType: {
          valueFormat: PropertyValueFormat.Array,
          typeName: `${middleField.type.typeName}[]`,
          memberType: {
            valueFormat: PropertyValueFormat.Struct,
            typeName: middleField.type.typeName,
            members: [
              {
                name: primitiveField.name,
                label: primitiveField.label,
                type: primitiveField.type,
              },
            ],
          },
        },
        parentFieldName: parentField.name,
      });
      expect(startStructSpy).to.be.calledTwice;
      startStructSpy.getCalls().forEach((call) =>
        expect(call.firstArg).to.containSubset({
          hierarchy: {
            field: { name: middleField.name },
            childFields: [
              {
                field: { name: primitiveField.name },
              },
            ],
          },
          valueType: {
            valueFormat: PropertyValueFormat.Struct,
            typeName: middleField.type.typeName,
            members: [
              {
                name: primitiveField.name,
                label: primitiveField.label,
                type: primitiveField.type,
              },
            ],
          },
          parentFieldName: parentField.name,
        }),
      );
      expect(processPrimitiveValueSpy.callCount).to.eq(2);
      expect(processPrimitiveValueSpy.getCall(0).firstArg).to.containSubset({
        field: {
          name: primitiveField.name,
        },
        valueType: primitiveField.type,
        parentFieldName: `${parentField.name}${FIELD_NAMES_SEPARATOR}${middleField.name}`,
        rawValue: "value1",
        displayValue: "display value 1",
      });
      expect(processPrimitiveValueSpy.getCall(1).firstArg).to.containSubset({
        field: {
          name: primitiveField.name,
        },
        valueType: primitiveField.type,
        parentFieldName: `${parentField.name}${FIELD_NAMES_SEPARATOR}${middleField.name}`,
        rawValue: "value2",
        displayValue: "display value 2",
      });
      expect(finishStructSpy).to.be.calledTwice;
      expect(finishArraySpy).to.be.calledOnce;
    });

    it("processes nested content item with deeply nested content as multi-level struct array value", () => {
      const startArraySpy = sinon.spy(visitor, "startArray");
      const finishArraySpy = sinon.spy(visitor, "finishArray");
      const startStructSpy = sinon.spy(visitor, "startStruct");
      const finishStructSpy = sinon.spy(visitor, "finishStruct");
      const processPrimitiveValueSpy = sinon.spy(visitor, "processPrimitiveValue");
      const category = createTestCategoryDescription();
      const primitiveField = createTestSimpleContentField({ name: "primitive", category });
      const middleField = createTestNestedContentField({ nestedFields: [primitiveField], category });
      const parentField = createTestNestedContentField({ nestedFields: [middleField], category });
      const descriptor = createTestContentDescriptor({ fields: [parentField], categories: [category] });
      const item = createTestContentItem({
        values: {
          [parentField.name]: [
            {
              primaryKeys: [createTestECInstanceKey()],
              values: {
                [middleField.name]: [
                  {
                    primaryKeys: [createTestECInstanceKey()],
                    values: {
                      [primitiveField.name]: "value1",
                    },
                    displayValues: {
                      [primitiveField.name]: "display value 1",
                    },
                    mergedFieldNames: [],
                  },
                ],
              },
              displayValues: {
                [middleField.name]: undefined,
              },
              mergedFieldNames: [],
            },
            {
              primaryKeys: [createTestECInstanceKey()],
              values: {
                [middleField.name]: [
                  {
                    primaryKeys: [createTestECInstanceKey()],
                    values: {
                      [primitiveField.name]: "value2",
                    },
                    displayValues: {
                      [primitiveField.name]: "display value 2",
                    },
                    mergedFieldNames: [],
                  },
                ],
              },
              displayValues: {
                [middleField.name]: undefined,
              },
              mergedFieldNames: [],
            },
          ],
        },
        displayValues: {
          [parentField.name]: undefined,
        },
      });
      traverseContentItem(visitor, descriptor, item);

      expect(startArraySpy).to.be.calledThrice;
      expect(startArraySpy.firstCall.firstArg).to.containSubset({
        hierarchy: {
          field: { name: parentField.name },
          childFields: [
            {
              field: { name: middleField.name },
              childFields: [
                {
                  field: { name: primitiveField.name },
                },
              ],
            },
          ],
        },
        valueType: {
          valueFormat: PropertyValueFormat.Array,
          typeName: `${parentField.type.typeName}[]`,
          memberType: {
            valueFormat: PropertyValueFormat.Struct,
            typeName: parentField.type.typeName,
            members: [
              {
                name: middleField.name,
                label: middleField.label,
                type: {
                  valueFormat: PropertyValueFormat.Array,
                  typeName: `${middleField.type.typeName}[]`,
                  memberType: {
                    valueFormat: PropertyValueFormat.Struct,
                    typeName: middleField.type.typeName,
                    members: [
                      {
                        name: primitiveField.name,
                        label: primitiveField.label,
                        type: primitiveField.type,
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
        parentFieldName: undefined,
      });
      [startArraySpy.secondCall, startArraySpy.thirdCall].forEach((call) =>
        expect(call.firstArg).to.containSubset({
          hierarchy: {
            field: { name: middleField.name },
            childFields: [
              {
                field: { name: primitiveField.name },
              },
            ],
          },
          valueType: {
            valueFormat: PropertyValueFormat.Array,
            typeName: `${middleField.type.typeName}[]`,
            memberType: {
              valueFormat: PropertyValueFormat.Struct,
              typeName: middleField.type.typeName,
              members: [
                {
                  name: primitiveField.name,
                  label: primitiveField.label,
                  type: primitiveField.type,
                },
              ],
            },
          },
          parentFieldName: parentField.name,
        }),
      );
      expect(startStructSpy.callCount).to.eq(4);
      [startStructSpy.getCall(0), startStructSpy.getCall(2)].forEach((call) =>
        expect(call.firstArg).to.containSubset({
          hierarchy: {
            field: { name: parentField.name },
            childFields: [
              {
                field: { name: middleField.name },
                childFields: [
                  {
                    field: { name: primitiveField.name },
                  },
                ],
              },
            ],
          },
          valueType: {
            valueFormat: PropertyValueFormat.Struct,
            typeName: parentField.type.typeName,
            members: [
              {
                name: middleField.name,
                label: middleField.label,
                type: {
                  valueFormat: PropertyValueFormat.Array,
                  typeName: `${middleField.type.typeName}[]`,
                  memberType: {
                    valueFormat: PropertyValueFormat.Struct,
                    typeName: middleField.type.typeName,
                    members: [
                      {
                        name: primitiveField.name,
                        label: primitiveField.label,
                        type: primitiveField.type,
                      },
                    ],
                  },
                },
              },
            ],
          },
          parentFieldName: undefined,
        }),
      );
      [startStructSpy.getCall(1), startStructSpy.getCall(3)].forEach((call) =>
        expect(call.firstArg).to.containSubset({
          hierarchy: {
            field: { name: middleField.name },
            childFields: [
              {
                field: { name: primitiveField.name },
              },
            ],
          },
          valueType: {
            valueFormat: PropertyValueFormat.Struct,
            typeName: middleField.type.typeName,
            members: [
              {
                name: primitiveField.name,
                label: primitiveField.label,
                type: primitiveField.type,
              },
            ],
          },
          parentFieldName: parentField.name,
        }),
      );
      expect(processPrimitiveValueSpy.callCount).to.eq(2);
      expect(processPrimitiveValueSpy.firstCall.firstArg).to.containSubset({
        field: {
          name: primitiveField.name,
        },
        valueType: primitiveField.type,
        parentFieldName: `${parentField.name}${FIELD_NAMES_SEPARATOR}${middleField.name}`,
        rawValue: "value1",
        displayValue: "display value 1",
      });
      expect(processPrimitiveValueSpy.secondCall.firstArg).to.containSubset({
        field: {
          name: primitiveField.name,
        },
        valueType: primitiveField.type,
        parentFieldName: `${parentField.name}${FIELD_NAMES_SEPARATOR}${middleField.name}`,
        rawValue: "value2",
        displayValue: "display value 2",
      });
      expect(finishStructSpy.callCount).to.eq(4);
      expect(finishArraySpy).to.be.calledThrice;
    });

    it("doesn't process primitive value nested under empty nested content item", () => {
      const startArraySpy = sinon.spy(visitor, "startArray");
      const processPrimitiveValueSpy = sinon.spy(visitor, "processPrimitiveValue");
      const category1 = createTestCategoryDescription();
      const category2 = createTestCategoryDescription();
      const primitiveField = createTestSimpleContentField({ name: "primitive", category: category1 });
      const parentField = createTestNestedContentField({ nestedFields: [primitiveField], category: category2 });
      const descriptor = createTestContentDescriptor({ fields: [parentField], categories: [category1, category2] });
      const item = createTestContentItem({
        values: {
          [parentField.name]: undefined,
        },
        displayValues: {
          [parentField.name]: undefined,
        },
      });
      traverseContentItem(visitor, descriptor, item);

      expect(startArraySpy).to.not.be.called;
      expect(startArraySpy).to.not.be.called;
      expect(processPrimitiveValueSpy).to.not.be.called;
    });

    it("doesn't process primitive value deeply nested under empty nested content item", () => {
      const startArraySpy = sinon.spy(visitor, "startArray");
      const processPrimitiveValueSpy = sinon.spy(visitor, "processPrimitiveValue");
      const category1 = createTestCategoryDescription();
      const category2 = createTestCategoryDescription();
      const primitiveField = createTestSimpleContentField({ name: "primitive", category: category1 });
      const middleField = createTestNestedContentField({ nestedFields: [primitiveField], category: category2 });
      const parentField = createTestNestedContentField({ nestedFields: [middleField], category: category2 });
      const descriptor = createTestContentDescriptor({ fields: [parentField], categories: [category1, category2] });
      const item = createTestContentItem({
        values: {
          [parentField.name]: [
            {
              primaryKeys: [createTestECInstanceKey()],
              values: {
                [middleField.name]: undefined,
              },
              displayValues: {
                [middleField.name]: undefined,
              },
              mergedFieldNames: [],
            },
          ],
        },
        displayValues: {
          [parentField.name]: undefined,
        },
      });
      traverseContentItem(visitor, descriptor, item);

      expect(startArraySpy).to.not.be.called;
      expect(startArraySpy).to.not.be.called;
      expect(processPrimitiveValueSpy).to.not.be.called;
    });
  });

  it("processes merged nested content under nested content item", () => {
    const startArraySpy = sinon.spy(visitor, "startArray");
    const finishArraySpy = sinon.spy(visitor, "finishArray");
    const startStructSpy = sinon.spy(visitor, "startStruct");
    const finishStructSpy = sinon.spy(visitor, "finishStruct");
    const processMergedValueSpy = sinon.spy(visitor, "processMergedValue");
    const category = createTestCategoryDescription();
    const primitiveField = createTestSimpleContentField({ name: "primitive", category });
    const mergedNestedField = createTestNestedContentField({ name: "mergedField", nestedFields: [primitiveField], category });
    const parentField = createTestNestedContentField({ name: "parentField", nestedFields: [mergedNestedField], category });
    const descriptor = createTestContentDescriptor({ fields: [parentField], categories: [category] });
    const item = createTestContentItem({
      values: {
        [parentField.name]: [
          {
            primaryKeys: [createTestECInstanceKey()],
            values: {
              [mergedNestedField.name]: undefined,
            },
            displayValues: {
              [mergedNestedField.name]: "Merged",
            },
            mergedFieldNames: [mergedNestedField.name],
          },
        ],
      },
      displayValues: {
        [parentField.name]: undefined,
      },
    });
    traverseContentItem(visitor, descriptor, item);

    expect(startArraySpy).to.be.calledOnce;
    expect(startArraySpy.firstCall.firstArg).to.containSubset({
      hierarchy: {
        field: { name: parentField.name },
      },
      valueType: {
        valueFormat: PropertyValueFormat.Array,
        typeName: `${parentField.type.typeName}[]`,
        memberType: {
          valueFormat: PropertyValueFormat.Struct,
          typeName: parentField.type.typeName,
          members: [
            {
              name: mergedNestedField.name,
              label: mergedNestedField.label,
            },
          ],
        },
      },
    });
    expect(finishArraySpy).to.be.calledOnce;

    expect(startStructSpy).to.be.calledOnce;
    expect(startStructSpy.firstCall.firstArg).to.containSubset({
      hierarchy: {
        field: { name: parentField.name },
        childFields: [
          {
            field: { name: mergedNestedField.name },
          },
        ],
      },
      valueType: {
        valueFormat: PropertyValueFormat.Struct,
        typeName: mergedNestedField.type.typeName,
        members: [
          {
            name: mergedNestedField.name,
            label: mergedNestedField.label,
          },
        ],
      },
    });
    expect(finishStructSpy).to.be.calledOnce;

    expect(processMergedValueSpy).to.be.calledOnce;
    expect(processMergedValueSpy.firstCall.firstArg).to.containSubset({
      mergedField: {
        name: mergedNestedField.name,
      },
      requestedField: {
        name: mergedNestedField.name,
      },
      parentFieldName: parentField.name,
    });
  });

  it("processes merged primitive value under nested content item", () => {
    const startArraySpy = sinon.spy(visitor, "startArray");
    const finishArraySpy = sinon.spy(visitor, "finishArray");
    const startStructSpy = sinon.spy(visitor, "startStruct");
    const finishStructSpy = sinon.spy(visitor, "finishStruct");
    const processMergedValueSpy = sinon.spy(visitor, "processMergedValue");
    const category = createTestCategoryDescription();
    const primitiveField = createTestSimpleContentField({ name: "primitive", category });
    const parentField = createTestNestedContentField({ name: "parentField", nestedFields: [primitiveField], category });
    const descriptor = createTestContentDescriptor({ fields: [parentField], categories: [category] });
    const item = createTestContentItem({
      values: {
        [parentField.name]: [
          {
            primaryKeys: [createTestECInstanceKey()],
            values: {
              [primitiveField.name]: undefined,
            },
            displayValues: {
              [primitiveField.name]: "Merged",
            },
            mergedFieldNames: [primitiveField.name],
          },
        ],
      },
      displayValues: {
        [parentField.name]: undefined,
      },
    });
    traverseContentItem(visitor, descriptor, item);

    expect(startArraySpy).to.be.calledOnce;
    expect(startArraySpy.firstCall.firstArg).to.containSubset({
      hierarchy: {
        field: { name: parentField.name },
        childFields: [
          {
            field: { name: primitiveField.name },
          },
        ],
      },
      valueType: {
        valueFormat: PropertyValueFormat.Array,
        typeName: `${parentField.type.typeName}[]`,
        memberType: {
          valueFormat: PropertyValueFormat.Struct,
          typeName: parentField.type.typeName,
          members: [
            {
              name: primitiveField.name,
              label: primitiveField.label,
              type: primitiveField.type,
            },
          ],
        },
      },
    });
    expect(finishArraySpy).to.be.calledOnce;

    expect(startStructSpy).to.be.calledOnce;
    expect(startStructSpy.firstCall.firstArg).to.containSubset({
      hierarchy: {
        field: { name: parentField.name },
        childFields: [
          {
            field: { name: primitiveField.name },
          },
        ],
      },
      valueType: {
        valueFormat: PropertyValueFormat.Struct,
        typeName: parentField.type.typeName,
        members: [
          {
            name: primitiveField.name,
            label: primitiveField.label,
            type: primitiveField.type,
          },
        ],
      },
    });
    expect(finishStructSpy).to.be.calledOnce;

    expect(processMergedValueSpy).to.be.calledOnce;
    expect(processMergedValueSpy.firstCall.firstArg).to.containSubset({
      mergedField: {
        name: primitiveField.name,
      },
      requestedField: {
        name: primitiveField.name,
      },
      parentFieldName: parentField.name,
    });
  });

  it("passes `NestedContentValue` labels to `startStruct`", () => {
    const startStructSpy = sinon.spy(visitor, "startStruct");
    const category = createTestCategoryDescription();
    const primitiveField1 = createTestSimpleContentField({ name: "primitive1", category });
    const primitiveField2 = createTestSimpleContentField({ name: "primitive2", category });
    const parentField = createTestNestedContentField({ nestedFields: [primitiveField1, primitiveField2], category });
    const nestedContentLabel1 = { displayValue: "Description 1", typeName: "string", rawValue: "" };
    const nestedContentLabel2 = { displayValue: "Description 2", typeName: "string", rawValue: "" };
    const descriptor = createTestContentDescriptor({ fields: [parentField], categories: [category] });
    const item = createTestContentItem({
      values: {
        [parentField.name]: [
          {
            labelDefinition: nestedContentLabel1,
            primaryKeys: [createTestECInstanceKey()],
            values: {
              [primitiveField1.name]: "value11",
              [primitiveField2.name]: "value12",
            },
            displayValues: {
              [primitiveField1.name]: "display value 11",
              [primitiveField2.name]: "display value 12",
            },
            mergedFieldNames: [],
          } satisfies NestedContentValue,
          {
            labelDefinition: nestedContentLabel2,
            primaryKeys: [createTestECInstanceKey()],
            values: {
              [primitiveField1.name]: "value21",
              [primitiveField2.name]: "value22",
            },
            displayValues: {
              [primitiveField1.name]: "display value 21",
              [primitiveField2.name]: "display value 22",
            },
            mergedFieldNames: [],
          } satisfies NestedContentValue,
        ],
      },
      displayValues: {
        [parentField.name]: undefined,
      },
    });
    traverseContentItem(visitor, descriptor, item);

    expect(startStructSpy).to.be.calledTwice;
    expect(startStructSpy.firstCall.firstArg).to.containSubset({ label: nestedContentLabel1 });
    expect(startStructSpy.secondCall.firstArg).to.containSubset({ label: nestedContentLabel2 });
  });

  it("passes deeply nested `NestedContentValue` labels to `startStruct`", () => {
    const startStructSpy = sinon.spy(visitor, "startStruct");
    const category = createTestCategoryDescription();
    const parentPrimitiveField = createTestSimpleContentField({ name: "primitive1", category });
    const childPrimitiveField = createTestSimpleContentField({ name: "primitive2", category });
    const childNestedContentField = createTestNestedContentField({ nestedFields: [childPrimitiveField], category });
    const parentNestedContentField = createTestNestedContentField({ nestedFields: [parentPrimitiveField, childNestedContentField], category });
    const parentNestedContentLabel = { displayValue: "Description 1", typeName: "string", rawValue: "" };
    const childNestedContentLabel = { displayValue: "Description 2", typeName: "string", rawValue: "" };
    const descriptor = createTestContentDescriptor({ fields: [parentNestedContentField], categories: [category] });
    const item = createTestContentItem({
      values: {
        [parentNestedContentField.name]: [
          {
            labelDefinition: parentNestedContentLabel,
            primaryKeys: [createTestECInstanceKey()],
            values: {
              [parentPrimitiveField.name]: "parentPrimitiveValue",
              [childNestedContentField.name]: [
                {
                  labelDefinition: childNestedContentLabel,
                  primaryKeys: [createTestECInstanceKey()],
                  values: {
                    [childPrimitiveField.name]: "ChildPrimitiveValue",
                  },
                  displayValues: {
                    [childNestedContentField.name]: "ChildPrimitiveDisplayValue",
                  },
                  mergedFieldNames: [],
                } satisfies NestedContentValue,
              ],
            },
            displayValues: {
              [parentPrimitiveField.name]: "ChildPrimitiveDisplayValue",
              [childNestedContentField.name]: "ChildNestedContentDisplayValue",
            },
            mergedFieldNames: [],
          } satisfies NestedContentValue,
        ],
      },
      displayValues: {
        [parentNestedContentField.name]: undefined,
      },
    });
    traverseContentItem(visitor, descriptor, item);

    expect(startStructSpy).to.be.calledTwice;
    expect(startStructSpy.firstCall.firstArg).to.containSubset({ label: parentNestedContentLabel });
    expect(startStructSpy.secondCall.firstArg).to.containSubset({ label: childNestedContentLabel });
  });
});

describe("addFieldHierarchy", () => {
  it("adds given hierarchy into empty list", () => {
    const list: FieldHierarchy[] = [];
    const hierarchy: FieldHierarchy = {
      field: createTestSimpleContentField(),
      childFields: [],
    };
    addFieldHierarchy(list, hierarchy);
    expect(list).to.deep.eq([hierarchy]);
  });

  it("adds given hierarchy under existing parent", () => {
    const category = createTestCategoryDescription();
    const sibling1 = createTestSimpleContentField({ name: "sibling1", category });
    const sibling2 = createTestSimpleContentField({ name: "sibling2", category });
    const parent = createTestNestedContentField({ name: "parent", category, nestedFields: [sibling1, sibling2] });
    const list: FieldHierarchy[] = [
      {
        field: parent,
        childFields: [
          {
            field: sibling1,
            childFields: [],
          },
        ],
      },
    ];
    addFieldHierarchy(list, { field: sibling2, childFields: [] });
    expect(list).to.deep.eq([
      {
        field: parent,
        childFields: [
          {
            field: sibling1,
            childFields: [],
          },
          {
            field: sibling2,
            childFields: [],
          },
        ],
      },
    ]);
  });

  it("adds existing child field under given parent hierarchy", () => {
    const category = createTestCategoryDescription();
    const sibling1 = createTestSimpleContentField({ name: "sibling1", category });
    const sibling2 = createTestSimpleContentField({ name: "sibling2", category });
    const parent = createTestNestedContentField({ name: "parent", category, nestedFields: [sibling1, sibling2] });
    const list: FieldHierarchy[] = [
      {
        field: sibling1,
        childFields: [],
      },
    ];
    addFieldHierarchy(list, {
      field: parent,
      childFields: [
        {
          field: sibling2,
          childFields: [],
        },
      ],
    });
    expect(list).to.deep.eq([
      {
        field: parent,
        childFields: [
          {
            field: sibling1,
            childFields: [],
          },
          {
            field: sibling2,
            childFields: [],
          },
        ],
      },
    ]);
  });

  it("merges siblings under common parent", () => {
    const category = createTestCategoryDescription();
    const sibling1 = createTestSimpleContentField({ name: "sibling1", category });
    const sibling2 = createTestSimpleContentField({ name: "sibling2", category });
    const parent = createTestNestedContentField({ name: "parent", category, nestedFields: [sibling1, sibling2] });
    const list: FieldHierarchy[] = [
      {
        field: sibling1,
        childFields: [],
      },
    ];
    addFieldHierarchy(list, {
      field: sibling2,
      childFields: [],
    });
    expect(list).to.deep.eq([
      {
        field: parent,
        childFields: [
          {
            field: sibling1,
            childFields: [],
          },
          {
            field: sibling2,
            childFields: [],
          },
        ],
      },
    ]);
  });

  it("merges hierarchies with common parent", () => {
    const category = createTestCategoryDescription();
    const sibling1 = createTestSimpleContentField({ name: "sibling1", category });
    const sibling2 = createTestSimpleContentField({ name: "sibling2", category });
    const parent = createTestNestedContentField({ name: "parent", category, nestedFields: [sibling1, sibling2] });
    const list: FieldHierarchy[] = [
      {
        field: parent,
        childFields: [
          {
            field: sibling1,
            childFields: [],
          },
        ],
      },
    ];
    addFieldHierarchy(list, {
      field: parent,
      childFields: [
        {
          field: sibling2,
          childFields: [],
        },
      ],
    });
    expect(list).to.deep.eq([
      {
        field: parent,
        childFields: [
          {
            field: sibling1,
            childFields: [],
          },
          {
            field: sibling2,
            childFields: [],
          },
        ],
      },
    ]);
  });

  it("merges equal hierarchies", () => {
    const category = createTestCategoryDescription();
    const child = createTestSimpleContentField({ name: "child", category });
    const parent = createTestNestedContentField({ name: "parent", category, nestedFields: [child] });
    const list: FieldHierarchy[] = [
      {
        field: parent,
        childFields: [
          {
            field: child,
            childFields: [],
          },
        ],
      },
    ];
    addFieldHierarchy(list, {
      field: parent,
      childFields: [
        {
          field: child,
          childFields: [],
        },
      ],
    });
    expect(list).to.deep.eq([
      {
        field: parent,
        childFields: [
          {
            field: child,
            childFields: [],
          },
        ],
      },
    ]);
  });

  it("doesn't merge hierarchies if categories are different", () => {
    const category1 = createTestCategoryDescription();
    const category2 = createTestCategoryDescription();
    const sibling1 = createTestSimpleContentField({ name: "sibling1", category: category1 });
    const sibling2 = createTestSimpleContentField({ name: "sibling2", category: category2 });
    createTestNestedContentField({ name: "parent", nestedFields: [sibling1, sibling2] });
    const list: FieldHierarchy[] = [
      {
        field: sibling1,
        childFields: [],
      },
    ];
    addFieldHierarchy(list, {
      field: sibling2,
      childFields: [],
    });
    expect(list).to.deep.eq([
      {
        field: sibling1,
        childFields: [],
      },
      {
        field: sibling2,
        childFields: [],
      },
    ]);
  });
});

describe("createFieldHierarchies", () => {
  it("creates field hierarchy with all nested fields under parent field's child fields even though their categories differ, when `ignoreCategories` parameter is set to true", () => {
    const nestedFields = [createTestSimpleContentField(), createTestSimpleContentField()];
    const nestedContentField = createTestNestedContentField({ nestedFields });
    const fieldHierarchies = createFieldHierarchies([nestedContentField], true);

    expect(fieldHierarchies).to.deep.eq([
      {
        field: nestedContentField,
        childFields: [
          {
            field: nestedFields[0],
            childFields: [],
          },
          {
            field: nestedFields[1],
            childFields: [],
          },
        ],
      },
    ]);
  });
});

describe("combineFieldNames", () => {
  it("returns field name when no parent field name is provided", () => {
    expect(combineFieldNames("x", undefined)).to.eq("x");
  });

  it("returns field name prefixed with parent field name", () => {
    expect(combineFieldNames("x", "y")).to.eq(`y${FIELD_NAMES_SEPARATOR}x`);
  });
});

describe("parseCombinedFieldNames", () => {
  it("returns parsed field names", () => {
    expect(parseCombinedFieldNames(`y${FIELD_NAMES_SEPARATOR}x`)).to.deep.eq(["y", "x"]);
  });

  it("returns empty array on empty string input", () => {
    expect(parseCombinedFieldNames("")).to.deep.eq([]);
  });
});
