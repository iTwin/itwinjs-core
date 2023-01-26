/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { PropertyValue, PropertyValueFormat } from "@itwin/appui-abstract";
import { PropertyFilterRuleGroupOperator, PropertyFilterRuleOperator } from "@itwin/components-react";
import { BeEvent } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { ClassInfo, RelationshipPath, PropertyValueFormat as TypeValueFormat } from "@itwin/presentation-common";
import { createTestNestedContentField, createTestPropertiesContentField, createTestPropertyInfo } from "@itwin/presentation-common/lib/cjs/test";
import { ECClassInfo, getIModelMetadataProvider } from "../../presentation-components/instance-filter-builder/ECMetadataProvider";
import { convertToInstanceFilterDefinition } from "../../presentation-components/instance-filter-builder/InstanceFilterConverter";
import {
  PresentationInstanceFilterCondition, PresentationInstanceFilterConditionGroup,
} from "../../presentation-components/instance-filter-builder/Types";

describe("convertToInstanceFilterDefinition", () => {
  describe("converts single condition with", () => {
    const testImodel = {} as IModelConnection;
    const property = createTestPropertyInfo();
    const field = createTestPropertiesContentField({ properties: [{ property }] });
    const value: PropertyValue = { valueFormat: PropertyValueFormat.Primitive, value: 1 };
    const propertyAccessor = `this.${property.name}`;

    describe("operator", () => {
      it("'IsNull'", async () => {
        const filter: PresentationInstanceFilterCondition = {
          field,
          operator: PropertyFilterRuleOperator.IsNull,
        };
        const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
        expect(expression).to.be.eq(`${propertyAccessor} = NULL`);
      });

      it("'IsNotNull'", async () => {
        const filter: PresentationInstanceFilterCondition = {
          field,
          operator: PropertyFilterRuleOperator.IsNotNull,
        };
        const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
        expect(expression).to.be.eq(`${propertyAccessor} <> NULL`);
      });

      it("'IsTrue'", async () => {
        const filter: PresentationInstanceFilterCondition = {
          field,
          operator: PropertyFilterRuleOperator.IsTrue,
        };
        const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
        expect(expression).to.be.eq(`${propertyAccessor} = TRUE`);
      });

      it("'IsFalse'", async () => {
        const filter: PresentationInstanceFilterCondition = {
          field,
          operator: PropertyFilterRuleOperator.IsFalse,
        };
        const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
        expect(expression).to.be.eq(`${propertyAccessor} = FALSE`);
      });

      it("'='", async () => {
        const filter: PresentationInstanceFilterCondition = {
          field,
          operator: PropertyFilterRuleOperator.IsEqual,
          value,
        };
        const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
        expect(expression).to.be.eq(`${propertyAccessor} = 1`);
      });

      it("'!='", async () => {
        const filter: PresentationInstanceFilterCondition = {
          field,
          operator: PropertyFilterRuleOperator.IsNotEqual,
          value,
        };
        const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
        expect(expression).to.be.eq(`${propertyAccessor} <> 1`);
      });

      it("'>'", async () => {
        const filter: PresentationInstanceFilterCondition = {
          field,
          operator: PropertyFilterRuleOperator.Greater,
          value,
        };
        const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
        expect(expression).to.be.eq(`${propertyAccessor} > 1`);
      });

      it("'>='", async () => {
        const filter: PresentationInstanceFilterCondition = {
          field,
          operator: PropertyFilterRuleOperator.GreaterOrEqual,
          value,
        };
        const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
        expect(expression).to.be.eq(`${propertyAccessor} >= 1`);
      });

      it("'<'", async () => {
        const filter: PresentationInstanceFilterCondition = {
          field,
          operator: PropertyFilterRuleOperator.Less,
          value,
        };
        const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
        expect(expression).to.be.eq(`${propertyAccessor} < 1`);
      });

      it("'<='", async () => {
        const filter: PresentationInstanceFilterCondition = {
          field,
          operator: PropertyFilterRuleOperator.LessOrEqual,
          value,
        };
        const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
        expect(expression).to.be.eq(`${propertyAccessor} <= 1`);
      });

      it("'Like'", async () => {
        const filter: PresentationInstanceFilterCondition = {
          field,
          operator: PropertyFilterRuleOperator.Like,
          value: { valueFormat: PropertyValueFormat.Primitive, value: `someString` },
        };
        const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
        expect(expression).to.be.eq(`${propertyAccessor} ~ "%someString%"`);
      });
    });

    it("quoted string value", async () => {
      const filter: PresentationInstanceFilterCondition = {
        field,
        operator: PropertyFilterRuleOperator.IsEqual,
        value: { ...value, value: `string "with" quotation marks` },
      };
      const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
      expect(expression).to.be.eq(`${propertyAccessor} = "string ""with"" quotation marks"`);
    });

    it("instance key value", async () => {
      const propertyInfo = createTestPropertyInfo({ type: "long" });
      const filter: PresentationInstanceFilterCondition = {
        field: createTestPropertiesContentField({ properties: [{ property: propertyInfo }], type: { valueFormat: TypeValueFormat.Primitive, typeName: "navigation" } }),
        operator: PropertyFilterRuleOperator.IsEqual,
        value: { ...value, value: { className: "TestSchema:TestClass", id: "0x1" } },
      };
      const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
      expect(expression).to.be.eq(`${propertyAccessor}.Id = 0x1`);
    });

    it("double value", async () => {
      const propertyInfo = createTestPropertyInfo({ type: "double" });
      const filter: PresentationInstanceFilterCondition = {
        field: createTestPropertiesContentField({ properties: [{ property: propertyInfo }], type: { valueFormat: TypeValueFormat.Primitive, typeName: "double" } }),
        operator: PropertyFilterRuleOperator.IsEqual,
        value: { ...value, value: 1.5 },
      };
      const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
      expect(expression).to.be.eq(`CompareDoubles(${propertyAccessor}, 1.5) = 0`);
    });

    it("dateTime value", async () => {
      const propertyInfo = createTestPropertyInfo({ type: "dateTime" });
      const filter: PresentationInstanceFilterCondition = {
        field: createTestPropertiesContentField({ properties: [{ property: propertyInfo }], type: { valueFormat: TypeValueFormat.Primitive, typeName: "dateTime" } }),
        operator: PropertyFilterRuleOperator.IsEqual,
        value: { ...value, value: "2021-10-12T08:45:41" },
      };
      const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
      expect(expression).to.be.eq(`CompareDateTimes(${propertyAccessor}, "2021-10-12T08:45:41") = 0`);
    });

    it("invalid operator", async () => {
      const filter: PresentationInstanceFilterCondition = {
        field: createTestPropertiesContentField({ properties: [{ property }] }),
        operator: "invalid" as unknown as PropertyFilterRuleOperator,
      };
      await expect(convertToInstanceFilterDefinition(filter, testImodel)).to.be.rejected;
    });
  });

  describe("converts condition group with", () => {
    const testImodel = {} as IModelConnection;
    const property = createTestPropertyInfo();
    const field = createTestPropertiesContentField({ properties: [{ property }] });
    const propertyAccessor = `this.${property.name}`;

    it("'AND' operator", async () => {
      const filter: PresentationInstanceFilterConditionGroup = {
        operator: PropertyFilterRuleGroupOperator.And,
        conditions: [{
          field,
          operator: PropertyFilterRuleOperator.IsNull,
        }, {
          field,
          operator: PropertyFilterRuleOperator.IsNotNull,
        }],
      };
      const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
      expect(expression).to.be.eq(`(${propertyAccessor} = NULL AND ${propertyAccessor} <> NULL)`);
    });

    it("'OR' operator", async () => {
      const filter: PresentationInstanceFilterConditionGroup = {
        operator: PropertyFilterRuleGroupOperator.Or,
        conditions: [{
          field,
          operator: PropertyFilterRuleOperator.IsNull,
        }, {
          field,
          operator: PropertyFilterRuleOperator.IsNotNull,
        }],
      };
      const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
      expect(expression).to.be.eq(`(${propertyAccessor} = NULL OR ${propertyAccessor} <> NULL)`);
    });

    it("nested condition group", async () => {
      const filter: PresentationInstanceFilterConditionGroup = {
        operator: PropertyFilterRuleGroupOperator.Or,
        conditions: [{
          field,
          operator: PropertyFilterRuleOperator.IsNull,
        }, {
          operator: PropertyFilterRuleGroupOperator.And,
          conditions: [{
            field,
            operator: PropertyFilterRuleOperator.IsNull,
          }, {
            field,
            operator: PropertyFilterRuleOperator.IsNotNull,
          }],
        }],
      };
      const { expression } = await convertToInstanceFilterDefinition(filter, testImodel);
      expect(expression).to.be.eq(`(${propertyAccessor} = NULL OR (${propertyAccessor} = NULL AND ${propertyAccessor} <> NULL))`);
    });

    it("invalid operator", async () => {
      const filter: PresentationInstanceFilterConditionGroup = {
        operator: "invalid" as unknown as PropertyFilterRuleGroupOperator,
        conditions: [{
          field,
          operator: PropertyFilterRuleOperator.IsNull,
        }, {
          field,
          operator: PropertyFilterRuleOperator.IsNotNull,
        }],
      };
      await expect(convertToInstanceFilterDefinition(filter, testImodel)).to.be.rejected;
    });
  });

  describe("handles related property", () => {
    function createAlias(className: string) {
      return `rel_${className}`;
    }

    const testImodel = {} as IModelConnection;
    const classAInfo: ClassInfo = { id: "0x1", name: "TestSchema:A", label: "A Class" };
    const classBInfo: ClassInfo = { id: "0x2", name: "TestSchema:B", label: "B Class" };
    const classCInfo: ClassInfo = { id: "0x3", name: "TestSchema:C", label: "C Class" };
    const classAToBInfo: ClassInfo = { id: "0x4", name: "TestSchema:AToB", label: "A To B" };
    const classBToCInfo: ClassInfo = { id: "0x5", name: "TestSchema:BToC", label: "B TO C" };
    const pathBToA: RelationshipPath = [{
      sourceClassInfo: classBInfo,
      targetClassInfo: classAInfo,
      relationshipInfo: classAToBInfo,
      isForwardRelationship: false,
      isPolymorphicRelationship: true,
      isPolymorphicTargetClass: true,
    }];
    const pathCToB: RelationshipPath = [{
      sourceClassInfo: classCInfo,
      targetClassInfo: classBInfo,
      relationshipInfo: classBToCInfo,
      isForwardRelationship: false,
      isPolymorphicRelationship: true,
      isPolymorphicTargetClass: true,
    }];
    const propertyInfo = createTestPropertyInfo({ classInfo: classCInfo });
    const classCPropertiesField = createTestPropertiesContentField({ properties: [{ property: propertyInfo }] });
    const classCNestedField = createTestNestedContentField({ nestedFields: [classCPropertiesField], pathToPrimaryClass: pathCToB });
    const classBNestedField = createTestNestedContentField({ nestedFields: [classCNestedField], pathToPrimaryClass: pathBToA });

    beforeEach(() => {
      classCPropertiesField.resetParentship();
      classCNestedField.resetParentship();
      classBNestedField.resetParentship();
    });

    it("in single condition", async () => {
      classCPropertiesField.rebuildParentship(classCNestedField);
      const filter: PresentationInstanceFilterCondition = {
        field: classCPropertiesField,
        operator: PropertyFilterRuleOperator.IsNull,
      };
      const { expression, relatedInstances } = await convertToInstanceFilterDefinition(filter, testImodel);
      expect(expression).to.be.eq(`${createAlias("C")}.${propertyInfo.name} = NULL`);
      expect(relatedInstances).to.be.lengthOf(1).and.containSubset([{
        pathFromSelectToPropertyClass: [{
          sourceClassName: classBInfo.name,
          targetClassName: classCInfo.name,
          relationshipName: classBToCInfo.name,
          isForwardRelationship: true,
        }],
        alias: createAlias("C"),
      }]);
    });

    it("in multiple conditions", async () => {
      classCPropertiesField.rebuildParentship(classCNestedField);
      const filter: PresentationInstanceFilterConditionGroup = {
        operator: PropertyFilterRuleGroupOperator.And,
        conditions: [{
          field: classCPropertiesField,
          operator: PropertyFilterRuleOperator.IsNull,
        }, {
          field: classCPropertiesField,
          operator: PropertyFilterRuleOperator.IsNotNull,
        }],
      };
      const { expression, relatedInstances } = await convertToInstanceFilterDefinition(filter, testImodel);
      expect(expression).to.be.eq(`(${createAlias("C")}.${propertyInfo.name} = NULL AND ${createAlias("C")}.${propertyInfo.name} <> NULL)`);
      expect(relatedInstances).to.be.lengthOf(1).and.containSubset([{
        pathFromSelectToPropertyClass: [{
          sourceClassName: classBInfo.name,
          targetClassName: classCInfo.name,
          relationshipName: classBToCInfo.name,
          isForwardRelationship: true,
        }],
        alias: createAlias("C"),
      }]);
    });

    it("in deeply nested condition field", async () => {
      classCNestedField.rebuildParentship(classBNestedField);
      const filter: PresentationInstanceFilterCondition = {
        field: classCPropertiesField,
        operator: PropertyFilterRuleOperator.IsNull,
      };
      const { expression, relatedInstances } = await convertToInstanceFilterDefinition(filter, testImodel);
      expect(expression).to.be.eq(`${createAlias("C")}.${propertyInfo.name} = NULL`);
      expect(relatedInstances).to.be.lengthOf(1).and.containSubset([{
        pathFromSelectToPropertyClass: [{
          sourceClassName: classAInfo.name,
          targetClassName: classBInfo.name,
          relationshipName: classAToBInfo.name,
          isForwardRelationship: true,
        }, {
          sourceClassName: classBInfo.name,
          targetClassName: classCInfo.name,
          relationshipName: classBToCInfo.name,
          isForwardRelationship: true,
        }],
        alias: createAlias("C"),
      }]);
    });
  });

  describe("returns base properties class", () => {
    async function* asyncGenerator(): AsyncIterableIterator<any> {
      return;
    }

    const onClose = new BeEvent<() => void>();
    const imodelMock = moq.Mock.ofType<IModelConnection>();

    const classAInfo: ClassInfo = { id: "0x1", name: "TestSchema:A", label: "A Class" };
    const classBInfo: ClassInfo = { id: "0x2", name: "TestSchema:B", label: "B Class" };
    const classCInfo: ClassInfo = { id: "0x3", name: "TestSchema:C", label: "C Class" };

    beforeEach(() => {
      imodelMock.setup((x) => x.key).returns(() => "test_imodel");
      imodelMock.setup((x) => x.onClose).returns(() => onClose);
      imodelMock.setup((x) => x.query).returns(() => () => asyncGenerator());

      // stub metadataProvider for test imodel
      const metadataProvider = getIModelMetadataProvider(imodelMock.object);
      sinon.stub(metadataProvider, "getECClassInfo").callsFake(async (id) => {
        switch (id) {
          case classAInfo.id:
            return new ECClassInfo(classAInfo.id, classAInfo.name, classAInfo.label, new Set(), new Set([classBInfo.id, classCInfo.id]));
          case classBInfo.id:
            return new ECClassInfo(classBInfo.id, classBInfo.name, classBInfo.label, new Set([classAInfo.id]), new Set([classCInfo.id]));
          case classCInfo.id:
            return new ECClassInfo(classCInfo.id, classCInfo.name, classCInfo.label, new Set([classAInfo.id, classBInfo.id]), new Set());
        }
        return undefined;
      });
    });

    afterEach(() => {
      sinon.resetBehavior();
      onClose.raiseEvent();
      imodelMock.reset();
    });

    it("when one property is used", async () => {
      const filter: PresentationInstanceFilterCondition = {
        field: createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ classInfo: classAInfo, name: "PropA" }) }] }),
        operator: PropertyFilterRuleOperator.IsNull,
      };

      const { selectClassName } = await convertToInstanceFilterDefinition(filter, imodelMock.object);
      expect(selectClassName).to.be.eq(classAInfo.name);
    });

    it("when all properties from same class", async () => {
      const filter: PresentationInstanceFilterConditionGroup = {
        operator: PropertyFilterRuleGroupOperator.And,
        conditions: [{
          field: createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ classInfo: classAInfo, name: "PropA1" }) }] }),
          operator: PropertyFilterRuleOperator.IsNull,
        }, {
          field: createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ classInfo: classAInfo, name: "PropA2" }) }] }),
          operator: PropertyFilterRuleOperator.IsNull,
        }],
      };

      const { selectClassName } = await convertToInstanceFilterDefinition(filter, imodelMock.object);
      expect(selectClassName).to.be.eq(classAInfo.name);
    });

    it("when second condition property is derived from first condition property", async () => {
      const filter: PresentationInstanceFilterConditionGroup = {
        operator: PropertyFilterRuleGroupOperator.And,
        conditions: [{
          field: createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ classInfo: classAInfo, name: "PropA" }) }] }),
          operator: PropertyFilterRuleOperator.IsNull,
        }, {
          field: createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ classInfo: classBInfo, name: "PropB" }) }] }),
          operator: PropertyFilterRuleOperator.IsNull,
        }],
      };

      const { selectClassName } = await convertToInstanceFilterDefinition(filter, imodelMock.object);
      expect(selectClassName).to.be.eq(classBInfo.name);
    });

    it("when first condition property is derived from second condition property", async () => {
      const filter: PresentationInstanceFilterConditionGroup = {
        operator: PropertyFilterRuleGroupOperator.And,
        conditions: [{
          field: createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ classInfo: classBInfo, name: "PropB" }) }] }),
          operator: PropertyFilterRuleOperator.IsNull,
        }, {
          field: createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ classInfo: classAInfo, name: "PropA" }) }] }),
          operator: PropertyFilterRuleOperator.IsNull,
        }],
      };

      const { selectClassName } = await convertToInstanceFilterDefinition(filter, imodelMock.object);
      expect(selectClassName).to.be.eq(classBInfo.name);
    });

    it("when properties from different derived classes are used", async () => {
      const filter: PresentationInstanceFilterConditionGroup = {
        operator: PropertyFilterRuleGroupOperator.And,
        conditions: [{
          field: createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ classInfo: classAInfo, name: "PropA" }) }] }),
          operator: PropertyFilterRuleOperator.IsNull,
        }, {
          field: createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ classInfo: classCInfo, name: "PropC" }) }] }),
          operator: PropertyFilterRuleOperator.IsNull,
        }, {
          field: createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ classInfo: classBInfo, name: "PropB" }) }] }),
          operator: PropertyFilterRuleOperator.IsNull,
        }],
      };

      const { selectClassName } = await convertToInstanceFilterDefinition(filter, imodelMock.object);
      expect(selectClassName).to.be.eq(classCInfo.name);
    });
  });
});
