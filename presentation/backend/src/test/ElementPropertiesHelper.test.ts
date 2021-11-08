/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { ECSqlStatement, ECSqlValue, IModelDb } from "@itwin/core-backend";
import { DbResult, Id64 } from "@itwin/core-bentley";
import { Content, PresentationError, PropertyValueFormat } from "@itwin/presentation-common";
import {
  createTestCategoryDescription, createTestContentDescriptor, createTestContentItem, createTestECClassInfo, createTestECInstanceKey,
  createTestNestedContentField, createTestSimpleContentField,
} from "@itwin/presentation-common/lib/cjs/test";
import { buildElementsProperties, getElementIdsByClass, getElementsCount } from "../presentation-backend/ElementPropertiesHelper";

describe("buildElementsProperties", () => {

  it("returns empty array when given undefined content", () => {
    expect(buildElementsProperties(undefined)).to.be.empty;
  });

  it("returns empty array when given content with no items", () => {
    expect(buildElementsProperties(new Content(
      createTestContentDescriptor({ fields: [] }),
      [],
    ))).to.be.empty;
  });

  it("sets class label", () => {
    expect(buildElementsProperties(new Content(
      createTestContentDescriptor({ fields: [] }),
      [
        createTestContentItem({
          classInfo: createTestECClassInfo({ label: "Test label" }),
          values: {},
          displayValues: {},
        }),
      ],
    ))).to.containSubset([{ class: "Test label" }]);
  });

  it("sets element label", () => {
    expect(buildElementsProperties(new Content(
      createTestContentDescriptor({ fields: [] }),
      [
        createTestContentItem({
          label: "Test label",
          values: {},
          displayValues: {},
        }),
      ],
    ))).to.containSubset([{ label: "Test label" }]);
  });

  it("sets invalid element id when content item has not primary keys", () => {
    expect(buildElementsProperties(new Content(
      createTestContentDescriptor({ fields: [] }),
      [
        createTestContentItem({
          primaryKeys: [],
          values: {},
          displayValues: {},
        }),
      ],
    ))).to.containSubset([{ id: Id64.invalid }]);
  });

  it("sets element id", () => {
    expect(buildElementsProperties(new Content(
      createTestContentDescriptor({ fields: [] }),
      [
        createTestContentItem({
          primaryKeys: [createTestECInstanceKey({ id: "0x123" })],
          values: {},
          displayValues: {},
        }),
      ],
    ))).to.containSubset([{ id: "0x123" }]);
  });

  it("categorizes properties", () => {
    const parentCategory = createTestCategoryDescription({ name: "cat1", label: "Parent Category" });
    const childCategory = createTestCategoryDescription({ name: "cat2", label: "Child Category", parent: parentCategory });
    expect(buildElementsProperties(new Content(
      createTestContentDescriptor({
        categories: [parentCategory, childCategory],
        fields: [
          createTestSimpleContentField({ name: "prop1", label: "Prop One", category: parentCategory }),
          createTestSimpleContentField({ name: "prop2", label: "Prop Two", category: childCategory }),
        ],
      }),
      [
        createTestContentItem({
          values: {
            prop1: "value1",
            prop2: "value2",
          },
          displayValues: {
            prop1: "Value One",
            prop2: "Value Two",
          },
        }),
      ],
    ))).to.deep.eq([{
      class: "",
      id: "0x1",
      label: "",
      items: {
        ["Parent Category"]: {
          type: "category",
          items: {
            ["Child Category"]: {
              type: "category",
              items: {
                ["Prop Two"]: {
                  type: "primitive",
                  value: "Value Two",
                },
              },
            },
            ["Prop One"]: {
              type: "primitive",
              value: "Value One",
            },
          },
        },
      },
    }]);
  });

  it("sets primitive property value to empty string when it's not set", () => {
    const category = createTestCategoryDescription({ label: "Test Category" });
    expect(buildElementsProperties(new Content(
      createTestContentDescriptor({
        categories: [category],
        fields: [
          createTestSimpleContentField({ name: "emptyProp", label: "EmptyProp", category }),
          createTestSimpleContentField({ name: "undefinedProps", label: "UndefinedProp", category }),
          createTestSimpleContentField({ name: "prop", label: "Prop", category }),
        ],
      }),
      [
        createTestContentItem({
          values: {
            emptyProp: undefined,
            undefinedProps: undefined,
            prop: "valid value",
          },
          displayValues: {
            emptyProp: "",
            undefinedProps: undefined,
            prop: "valid value",
          },
        }),
      ],
    ))).to.deep.eq([{
      class: "",
      id: "0x1",
      label: "",
      items: {
        ["Test Category"]: {
          type: "category",
          items: {
            ["EmptyProp"]: {
              type: "primitive",
              value: "",
            },
            ["UndefinedProp"]: {
              type: "primitive",
              value: "",
            },
            ["Prop"]: {
              type: "primitive",
              value: "valid value",
            },
          },
        },
      },
    }]);
  });

  it("does not include category if it only has nested content field without values", () => {
    const category = createTestCategoryDescription({ label: "Test Category" });
    expect(buildElementsProperties(new Content(
      createTestContentDescriptor({
        categories: [category],
        fields: [
          createTestNestedContentField({ name: "nestedField", category, nestedFields: [createTestSimpleContentField({ name: "primitiveField" })] }),
        ],
      }),
      [
        createTestContentItem({
          values: {
            nestedField: [],
          },
          displayValues: {
            nestedField: [],
          },
        }),
      ],
    ))).to.deep.eq([{
      class: "",
      id: "0x1",
      label: "",
      items: {},
    }]);
  });

  it("sets property value to empty string when it's merged", () => {
    const category = createTestCategoryDescription({ label: "Test Category" });
    expect(buildElementsProperties(new Content(
      createTestContentDescriptor({
        categories: [category],
        fields: [
          createTestSimpleContentField({ name: "prop", label: "Prop", category }),
        ],
      }),
      [
        createTestContentItem({
          values: {
            prop: "anything",
          },
          displayValues: {
            prop: "anything",
          },
          mergedFieldNames: ["prop"],
        }),
      ],
    ))).to.deep.eq([{
      class: "",
      id: "0x1",
      label: "",
      items: {
        ["Test Category"]: {
          type: "category",
          items: {
            ["Prop"]: {
              type: "primitive",
              value: "",
            },
          },
        },
      },
    }]);
  });

  it("handles struct properties", () => {
    const category = createTestCategoryDescription({ label: "Test Category" });
    expect(buildElementsProperties(new Content(
      createTestContentDescriptor({
        categories: [category],
        fields: [
          createTestSimpleContentField({
            name: "prop",
            label: "Prop",
            category,
            type: {
              valueFormat: PropertyValueFormat.Struct,
              typeName: "Test Struct",
              members: [{
                name: "member1",
                label: "Member One",
                type: {
                  valueFormat: PropertyValueFormat.Primitive,
                  typeName: "Primitive One",
                },
              }, {
                name: "member2",
                label: "Member Two",
                type: {
                  valueFormat: PropertyValueFormat.Primitive,
                  typeName: "Primitive Two",
                },
              }],
            },
          }),
        ],
      }),
      [
        createTestContentItem({
          values: {
            prop: {
              member1: "value1",
              member2: "value2",
            },
          },
          displayValues: {
            prop: {
              member1: "Value One",
              member2: "Value Two",
            },
          },
        }),
      ],
    ))).to.deep.eq([{
      class: "",
      id: "0x1",
      label: "",
      items: {
        ["Test Category"]: {
          type: "category",
          items: {
            ["Prop"]: {
              type: "struct",
              members: {
                ["Member One"]: {
                  type: "primitive",
                  value: "Value One",
                },
                ["Member Two"]: {
                  type: "primitive",
                  value: "Value Two",
                },
              },
            },
          },
        },
      },
    }]);
  });

  it("handles primitive array properties", () => {
    const category = createTestCategoryDescription({ label: "Test Category" });
    expect(buildElementsProperties(new Content(
      createTestContentDescriptor({
        categories: [category],
        fields: [
          createTestSimpleContentField({
            name: "prop",
            label: "Prop",
            category,
            type: {
              valueFormat: PropertyValueFormat.Array,
              typeName: "Test Array",
              memberType: {
                valueFormat: PropertyValueFormat.Primitive,
                typeName: "Test Primitive",
              },
            },
          }),
        ],
      }),
      [
        createTestContentItem({
          values: {
            prop: ["value1", "value2"],
          },
          displayValues: {
            prop: ["Value One", "Value Two"],
          },
        }),
      ],
    ))).to.deep.eq([{
      class: "",
      id: "0x1",
      label: "",
      items: {
        ["Test Category"]: {
          type: "category",
          items: {
            ["Prop"]: {
              type: "array",
              valueType: "primitive",
              values: ["Value One", "Value Two"],
            },
          },
        },
      },
    }]);
  });

  it("handles struct array properties", () => {
    const category = createTestCategoryDescription({ label: "Test Category" });
    expect(buildElementsProperties(new Content(
      createTestContentDescriptor({
        categories: [category],
        fields: [
          createTestSimpleContentField({
            name: "prop",
            label: "Prop",
            category,
            type: {
              valueFormat: PropertyValueFormat.Array,
              typeName: "Test Array",
              memberType: {
                valueFormat: PropertyValueFormat.Struct,
                typeName: "Test Struct",
                members: [{
                  name: "member",
                  label: "Test Member",
                  type: {
                    valueFormat: PropertyValueFormat.Primitive,
                    typeName: "Test Primitive",
                  },
                }],
              },
            },
          }),
        ],
      }),
      [
        createTestContentItem({
          values: {
            prop: [{
              member: "value1",
            }, {
              member: "value2",
            }],
          },
          displayValues: {
            prop: [{
              member: "Value One",
            }, {
              member: "Value Two",
            }],
          },
        }),
      ],
    ))).to.deep.eq([{
      class: "",
      id: "0x1",
      label: "",
      items: {
        ["Test Category"]: {
          type: "category",
          items: {
            ["Prop"]: {
              type: "array",
              valueType: "struct",
              values: [{
                ["Test Member"]: {
                  type: "primitive",
                  value: "Value One",
                },
              }, {
                ["Test Member"]: {
                  type: "primitive",
                  value: "Value Two",
                },
              }],
            },
          },
        },
      },
    }]);
  });

});

describe("getElementsCount", () => {
  const imodelMock = moq.Mock.ofType<IModelDb>();
  beforeEach(() => {
    imodelMock.reset();
  });

  it("returns 0 when statement has no rows", () => {
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny())).returns((_q, cb) => {
      const statementMock = moq.Mock.ofType<ECSqlStatement>();
      statementMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_DONE);
      return cb(statementMock.object);
    });
    expect(getElementsCount(imodelMock.object)).to.be.eq(0);
  });

  it("returns count when statement has row", () => {
    const elementCount = 3;
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny())).returns((_q, cb) => {
      const valueMock = moq.Mock.ofType<ECSqlValue>();
      valueMock.setup((x) => x.getInteger()).returns(() => elementCount);
      const statementMock = moq.Mock.ofType<ECSqlStatement>();
      statementMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_ROW);
      statementMock.setup((x) => x.getValue(0)).returns(() => valueMock.object);
      return cb(statementMock.object);
    });
    expect(getElementsCount(imodelMock.object)).to.be.eq(elementCount);
  });

  it("adds WHERE clause when class list is defined and not empty", () => {
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.is((query) => query.includes("WHERE")), moq.It.isAny()))
      .returns(() => 0).verifiable();
    getElementsCount(imodelMock.object, ["TestSchema:TestClass"]);
    imodelMock.verifyAll();
  });

  it("throws if class list contains invalid class name", () => {
    expect(() => getElementIdsByClass(imodelMock.object, ["'TestSchema:TestClass'"])).to.throw(PresentationError);
    expect(() => getElementIdsByClass(imodelMock.object, ["%TestSchema:TestClass%"])).to.throw(PresentationError);
    expect(() => getElementIdsByClass(imodelMock.object, ["TestSchema:TestClass  "])).to.throw(PresentationError);
  });

});

describe("getElementIdsByClass", () => {
  const imodelMock = moq.Mock.ofType<IModelDb>();
  beforeEach(() => {
    imodelMock.reset();
  });

  it("returns empty map when statement has no rows", () => {
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny())).returns((_q, cb) => {
      const statementMock = moq.Mock.ofType<ECSqlStatement>();
      statementMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_DONE);
      return cb(statementMock.object);
    });
    expect(getElementIdsByClass(imodelMock.object)).to.be.deep.eq(new Map<string, string[]>());
  });

  it("returns ids grouped by class when statement has rows", () => {
    const elements = [
      { className: "TestSchema:TestClass", id: "0x1" },
      { className: "TestSchema:TestClass", id: "0x2" },
      { className: "TestSchema:TestClass2", id: "0x3" },
      { className: "TestSchema:TestClass", id: "0x4" },
    ];
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny())).returns((_q, cb) => {
      const statementMock = moq.Mock.ofType<ECSqlStatement>();
      for (const element of elements) {
        statementMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_ROW);
        statementMock.setup((x) => x.getRow()).returns(() => ({ elId: element.id, elClassName: element.className }));
      }
      statementMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_DONE);
      return cb(statementMock.object);
    });
    const expectedResult = new Map<string, string[]>([
      ["TestSchema:TestClass", ["0x1", "0x2", "0x4"]],
      ["TestSchema:TestClass2", ["0x3"]],
    ]);
    expect(getElementIdsByClass(imodelMock.object)).to.be.deep.eq(expectedResult);
  });

  it("skips rows without class name or id", () => {
    const elements = [
      { className: undefined, id: "0x1" },
      { className: "TestSchema:TestClass", id: undefined },
      { className: "TestSchema:TestClass", id: "0x2" },
    ];
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny())).returns((_q, cb) => {
      const statementMock = moq.Mock.ofType<ECSqlStatement>();
      for (const element of elements) {
        statementMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_ROW);
        statementMock.setup((x) => x.getRow()).returns(() => ({ elId: element.id, elClassName: element.className }));
      }
      statementMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_DONE);
      return cb(statementMock.object);
    });
    const expectedResult = new Map<string, string[]>([
      ["TestSchema:TestClass", ["0x2"]],
    ]);
    expect(getElementIdsByClass(imodelMock.object)).to.be.deep.eq(expectedResult);
  });

  it("adds WHERE clause when class list is defined and not empty", () => {
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.is((query) => query.includes("WHERE")), moq.It.isAny()))
      .verifiable();
    getElementIdsByClass(imodelMock.object, ["TestSchema:TestClass"]);
    imodelMock.verifyAll();
  });

  it("throws if class list contains invalid class name", () => {
    expect(() => getElementIdsByClass(imodelMock.object, ["'TestSchema:TestClass'"])).to.throw(PresentationError);
    expect(() => getElementIdsByClass(imodelMock.object, ["%TestSchema:TestClass%"])).to.throw(PresentationError);
    expect(() => getElementIdsByClass(imodelMock.object, ["TestSchema:TestClass  "])).to.throw(PresentationError);
  });

  it("does not add LIMIT clause when page options are invalid", () => {
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.is((query) => !query.includes("LIMIT")), moq.It.isAny()))
      .verifiable();
    getElementIdsByClass(imodelMock.object, undefined, { size: undefined, start: undefined });
    imodelMock.verifyAll();
  });

  it("adds LIMIT clause when page options are valid", () => {
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.is((query) => query.includes("LIMIT 10 OFFSET 15")), moq.It.isAny()))
      .verifiable();
    getElementIdsByClass(imodelMock.object, undefined, { size: 10, start: 15 });
    imodelMock.verifyAll();
  });

  it("adds LIMIT clause when page options are valid", () => {
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.is((query) => query.includes("LIMIT 10 OFFSET 15")), moq.It.isAny()))
      .verifiable();
    getElementIdsByClass(imodelMock.object, undefined, { size: 10, start: 15 });
    imodelMock.verifyAll();
  });

  it("add correct LIMIT clause when page options does not have size set", () => {
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.is((query) => query.includes("LIMIT -1 OFFSET 15")), moq.It.isAny()))
      .verifiable();
    getElementIdsByClass(imodelMock.object, undefined, { start: 15 });
    imodelMock.verifyAll();
  });

  it("add correct LIMIT clause when page options does not have start set", () => {
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.is((query) => query.includes("LIMIT 10 OFFSET 0")), moq.It.isAny()))
      .verifiable();
    getElementIdsByClass(imodelMock.object, undefined, { size: 10 });
    imodelMock.verifyAll();
  });

});
