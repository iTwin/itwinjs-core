/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import { Content, ContentSpecificationTypes, DefaultContentDisplayTypes, InstanceKey, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { buildTestIModelConnection, importSchema, insertDocumentPartition, insertElementAspect, insertPhysicalPartition } from "../../IModelSetupUtils";
import { collect } from "../../Utils";
import { describeContentTestSuite } from "./Utils";

describeContentTestSuite("Custom categories", () => {
  it("creates child class category", async function () {
    let instanceKey: InstanceKey;
    const imodelConnection = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
      instanceKey = insertDocumentPartition(db, "Test");
    });

    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.SelectedNodeInstances,
              propertyCategories: [
                {
                  id: "custom-category",
                  label: "Custom Category",
                },
              ],
              propertyOverrides: [
                {
                  name: "*",
                  categoryId: { type: "Id", categoryId: "custom-category", createClassCategory: true },
                },
              ],
            },
          ],
        },
      ],
    };
    const content = await Presentation.presentation
      .getContentIterator({
        imodel: imodelConnection,
        rulesetOrId: ruleset,
        keys: new KeySet([instanceKey!]),
        descriptor: {},
      })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));

    expect(content!.descriptor.categories).to.containSubset([{ label: "Document Partition" }, { label: "Custom Category" }]);

    expect(content!.descriptor.fields).to.containSubset([
      {
        category: {
          label: "Document Partition",
          parent: {
            label: "Custom Category",
          },
        },
      },
    ]);
  });

  it("moves calculated property into schema-based category", async function () {
    let elementKey!: InstanceKey;
    let schemaName!: string;
    const imodelConnection = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
      schemaName = importSchema(
        this,
        db,
        `
          <ECSchemaReference name="BisCore" version="1.0.0" alias="bis"/>
          <PropertyCategory typeName="MyCategory" displayLabel="My Category" />
          <ECEntityClass typeName="MyAspect">
            <BaseClass>bis:ElementMultiAspect</BaseClass>
            <ECProperty propertyName="AspectProperty" typeName="int" category="MyCategory" />
          </ECEntityClass>
        `,
      ).schemaName;
      elementKey = insertPhysicalPartition({
        db,
        codeValue: "Test partition",
        parentId: IModel.rootSubjectId,
      });
      insertElementAspect({
        db,
        classFullName: `${schemaName}:MyAspect`,
        elementId: elementKey.id,
      });
    });

    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.SelectedNodeInstances,
              calculatedProperties: [
                {
                  label: "Calculated property",
                  categoryId: {
                    type: "SchemaCategory",
                    categoryName: `${schemaName}:MyCategory`,
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    const descriptor = await Presentation.presentation.getContentDescriptor({
      imodel: imodelConnection,
      rulesetOrId: ruleset,
      displayType: DefaultContentDisplayTypes.PropertyPane,
      keys: new KeySet([elementKey]),
    });

    expect(descriptor!.categories).to.containSubset([{ label: "My Category" }]);
    expect(descriptor!.fields).to.containSubset([
      {
        label: "MyAspect",
        nestedFields: [
          {
            label: "AspectProperty",
            category: {
              label: "My Category",
              parent: {
                label: "$élêçtèd Ítêm(s)",
              },
            },
          },
        ],
      },
      {
        label: "Calculated property",
        category: {
          label: "My Category",
          parent: {
            label: "$élêçtèd Ítêm(s)",
          },
        },
      },
    ]);
  });
});
