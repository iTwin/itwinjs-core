/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Presentation } from "@itwin/presentation-frontend";
import { describeContentTestSuite } from "./Utils";
import { ContentSpecificationTypes, DefaultContentDisplayTypes, KeySet, LabelDefinition, Rule, Ruleset, RuleTypes, Value } from "@itwin/presentation-common";
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

// TODO: Enable tests after PR is merged: https://github.com/iTwin/imodel-native/pull/811

describeContentTestSuite("Content Display Labels", () => {
  const EMPTY_LABEL = LabelDefinition.fromLabelString("@Presentation:label.notSpecified@");

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

  xit("each related content item has display label", async () => {
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
      }
    }
  });

  xit("applies correctly class name label override", async () => {
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

  xit("applies correctly composite label override", async () => {
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
