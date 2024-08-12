/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Presentation } from "@itwin/presentation-frontend";
import { describeContentTestSuite } from "./Utils";
import {
  ContentSpecificationTypes,
  DefaultContentDisplayTypes,
  KeySet,
  LabelDefinition,
  NestedContentValue,
  Rule,
  Ruleset,
  RuleTypes,
  Value,
} from "@itwin/presentation-common";
import { Guid } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import {
  buildTestIModelConnection,
  importSchema,
  insertElementAspect,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
} from "../../IModelSetupUtils";
import { expect } from "chai";
import { collect } from "../../Utils";

describeContentTestSuite("Content Display Labels", () => {
  const EMPTY_LABEL = LabelDefinition.fromLabelString("@Presentation:label.notSpecified@");

  describe("Nested content from aspects", () => {
    let imodel: IModelConnection;
    let schemaName: string;
    const elementClassName = "Generic.PhysicalObject";

    before(async function () {
      const schemaXml = `
        <ECSchemaReference name="BisCore" version="1.0.0" alias="bis"/>
        <ECEntityClass typeName="Color">
          <BaseClass>bis:ElementMultiAspect</BaseClass>
          <ECProperty propertyName="R" typeName="int" />
          <ECProperty propertyName="G" typeName="int" />
          <ECProperty propertyName="B" typeName="int" />
        </ECEntityClass>
      `;
      imodel = await buildTestIModelConnection(this.test!.title, async (db) => {
        const schema = importSchema(this, db, schemaXml);
        schemaName = schema.schemaName;
        const { id: modelId } = insertPhysicalModelWithPartition({ db, codeValue: "Model" });
        const { id: categoryId } = insertSpatialCategory({ db, codeValue: "Category" });
        for (let i = 0; i < 5; ++i) {
          const { id: elementId } = insertPhysicalElement({
            db,
            modelId,
            categoryId,
            classFullName: elementClassName,
          });

          insertElementAspect({
            db,
            classFullName: schema.items.Color.fullName,
            elementId,
            ["R"]: i,
            ["G"]: i + 1,
            ["B"]: i + 2,
          });

          insertElementAspect({
            db,
            classFullName: schema.items.Color.fullName,
            elementId,
            ["R"]: i + 100,
            ["G"]: i + 101,
            ["B"]: i + 102,
          });
        }
      });
    });

    after(async () => imodel?.close());

    function createRuleset(...additionalRules: Rule[]): Ruleset {
      return {
        id: Guid.createValue(),
        rules: [
          {
            ruleType: RuleTypes.Content,
            specifications: [
              {
                specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
                classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
                relatedProperties: [
                  {
                    propertiesSource: {
                      direction: "Forward",
                      relationship: { schemaName: "BisCore", className: "ElementOwnsMultiAspects" },
                      targetClass: { schemaName, className: "Color" },
                    },
                    properties: "*",
                    relationshipMeaning: "RelatedInstance",
                  },
                ],
              },
            ],
          },
          ...additionalRules,
        ],
      };
    }

    it("returns related content items with display label", async () => {
      const ruleset = createRuleset();
      const { items } = (await Presentation.presentation.getContentIterator({
        imodel,
        rulesetOrId: ruleset,
        descriptor: { displayType: DefaultContentDisplayTypes.Grid },
        keys: new KeySet(),
      }))!;

      for await (const item of items) {
        for (const value of Object.values(item.values)) {
          if (!Value.isNestedContent(value)) {
            continue;
          }
          expect(value.length).to.eq(2);
          expect(value[0].labelDefinition).to.deep.eq(EMPTY_LABEL);
          expect(value[1].labelDefinition).to.deep.eq(EMPTY_LABEL);
        }
      }
    });

    it("applies class name label override on nested content values", async () => {
      const ruleset = createRuleset({
        ruleType: RuleTypes.InstanceLabelOverride,
        class: { schemaName, className: "Color" },
        values: [{ specType: "ClassName" }],
      });

      const { items } = (await Presentation.presentation.getContentIterator({
        imodel,
        rulesetOrId: ruleset,
        descriptor: { displayType: DefaultContentDisplayTypes.Grid },
        keys: new KeySet(),
      }))!;

      for await (const item of items) {
        for (const value of Object.values(item.values)) {
          if (!Value.isNestedContent(value)) {
            continue;
          }
          expect(value.length).to.eq(2);
          expect(value[0].labelDefinition?.displayValue).to.eq("Color");
          expect(value[1].labelDefinition?.displayValue).to.eq("Color");
        }
      }
    });

    it("applies composite label override on nested content values", async () => {
      const ruleset = createRuleset({
        ruleType: RuleTypes.InstanceLabelOverride,
        class: { schemaName, className: "Color" },
        values: [
          {
            // Label: R,G,B
            specType: "Composite",
            separator: ",",
            parts: [
              {
                spec: { specType: "Property", propertyName: "R" },
                isRequired: true,
              },
              {
                spec: { specType: "Property", propertyName: "G" },
                isRequired: true,
              },
              {
                spec: { specType: "Property", propertyName: "B" },
                isRequired: true,
              },
            ],
          },
        ],
      });

      const { items } = (await Presentation.presentation.getContentIterator({
        imodel,
        rulesetOrId: ruleset,
        descriptor: { displayType: DefaultContentDisplayTypes.Grid },
        keys: new KeySet(),
      }))!;

      (await collect(items)).forEach((item, idx) => {
        for (const value of Object.values(item.values)) {
          if (!Value.isNestedContent(value)) {
            continue;
          }
          expect(value.length).to.eq(2);
          expect(value[0].labelDefinition?.displayValue).to.eq(`${idx},${idx + 1},${idx + 2}`);
          expect(value[1].labelDefinition?.displayValue).to.eq(`${idx + 100},${idx + 101},${idx + 102}`);
        }
      });
    });
  });

  describe("Deeply nested related instances", () => {
    let imodel: IModelConnection | undefined;

    afterEach(async () => {
      await imodel?.close();
      imodel = undefined;
    });

    function createRuleset(...additionalRules: Rule[]): Ruleset {
      return {
        id: Guid.createValue(),
        rules: [
          {
            ruleType: "Content",
            specifications: [
              {
                specType: "ContentInstancesOfSpecificClasses",
                classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
                relatedProperties: [
                  {
                    propertiesSource: {
                      direction: "Forward",
                      relationship: { schemaName: "BisCore", className: "ElementOwnsChildElements" },
                    },
                    nestedRelatedProperties: [
                      {
                        propertiesSource: {
                          direction: "Forward",
                          relationship: { schemaName: "BisCore", className: "ElementOwnsChildElements" },
                        },
                        relationshipMeaning: "RelatedInstance",
                      },
                    ],
                    relationshipMeaning: "RelatedInstance",
                  },
                ],
              },
            ],
          },
          ...additionalRules,
        ],
      };
    }

    function validateDeeplyNestedContent(nestedContent: Pick<NestedContentValue, "labelDefinition" | "values">, expectedDisplayLabelsStack: Array<string>) {
      const expectedLabel = LabelDefinition.fromLabelString(expectedDisplayLabelsStack.pop()!);

      expect(nestedContent.labelDefinition).to.deep.eq(expectedLabel);
      if (expectedDisplayLabelsStack.length === 0) {
        return;
      }

      const next = Object.values(nestedContent.values).find((x) => Value.isNestedContent(x)) as NestedContentValue[];
      validateDeeplyNestedContent(next[0], expectedDisplayLabelsStack);
    }

    it("applies class name label override on nested content values", async function () {
      imodel = await buildTestIModelConnection(this.test!.title, async (db) => {
        const { id: modelId } = insertPhysicalModelWithPartition({ db, codeValue: "Model" });
        const { id: categoryId } = insertSpatialCategory({ db, codeValue: "Category" });
        const { id: parentId } = insertPhysicalElement({
          db,
          modelId,
          categoryId,
        });
        const { id: middleChildId } = insertPhysicalElement({
          db,
          modelId,
          categoryId,
          parentId,
        });
        insertPhysicalElement({
          db,
          modelId,
          categoryId,
          parentId: middleChildId,
        });
      });
      const { items } = (await Presentation.presentation.getContentIterator({
        imodel,
        rulesetOrId: createRuleset({
          ruleType: "InstanceLabelOverride",
          priority: 9999,
          class: { schemaName: "BisCore", className: "Element" },
          values: [{ specType: "ClassName" }],
        }),
        descriptor: { displayType: DefaultContentDisplayTypes.Grid },
        keys: new KeySet(),
      }))!;

      const arr = await collect(items);
      validateDeeplyNestedContent(
        {
          labelDefinition: arr[0].label,
          values: arr[0].values,
        },
        ["PhysicalObject", "PhysicalObject", "PhysicalObject"],
      );
    });

    it("applies specific property label override on nested content values", async function () {
      imodel = await buildTestIModelConnection(this.test!.title, async (db) => {
        const { id: modelId } = insertPhysicalModelWithPartition({ db, codeValue: "Model" });
        const { id: categoryId } = insertSpatialCategory({ db, codeValue: "Category" });
        const { id: parentId } = insertPhysicalElement({
          db,
          modelId,
          categoryId,
          userLabel: "Parent",
        });
        const { id: middleChildId } = insertPhysicalElement({
          db,
          modelId,
          categoryId,
          parentId,
          userLabel: "MiddleChild",
        });
        insertPhysicalElement({
          db,
          modelId,
          categoryId,
          parentId: middleChildId,
          userLabel: "Child",
        });
      });

      const { items } = (await Presentation.presentation.getContentIterator({
        imodel,
        rulesetOrId: createRuleset({
          ruleType: "InstanceLabelOverride",
          priority: 9999,
          class: { schemaName: "Generic", className: "PhysicalObject" },
          values: [
            {
              specType: "Property",
              propertyName: "UserLabel",
            },
          ],
        }),
        descriptor: { displayType: DefaultContentDisplayTypes.Grid },
        keys: new KeySet(),
      }))!;

      const arr = await collect(items);
      validateDeeplyNestedContent(
        {
          labelDefinition: arr[0].label,
          values: arr[0].values,
        },
        ["Child", "MiddleChild", "Parent"],
      );
    });
  });
});
