/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { assert, Guid, Id64 } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import {
  ChildNodeSpecificationTypes,
  ContentSpecificationTypes,
  Descriptor,
  DisplayValueGroup,
  FieldDescriptor,
  KeySet,
  RelationshipDirection,
  Ruleset,
  RuleTypes,
} from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { collect, getFieldByLabel } from "../../Utils";
import {
  buildTestIModelConnection,
  insertDocumentPartition,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
} from "../../IModelSetupUtils";
import { describeContentTestSuite } from "./Utils";

describeContentTestSuite("Distinct Values", ({ getDefaultSuiteIModel }) => {
  async function validatePagedDistinctValuesResponse(
    db: IModelConnection,
    ruleset: Ruleset,
    keys: KeySet,
    descriptor: Descriptor | {},
    fieldDescriptor: FieldDescriptor,
    expectedResult: DisplayValueGroup[],
  ) {
    // first request all pages and confirm the result is valid
    const allDistinctValues = await Presentation.presentation
      .getDistinctValuesIterator({ imodel: db, rulesetOrId: ruleset, keys, descriptor, fieldDescriptor })
      .then(async (x) => ({ ...x, items: await collect(x.items) }));
    expect(allDistinctValues).to.be.deep.equal({
      total: expectedResult.length,
      items: expectedResult,
    });

    // then request in pages and confirm it's still okay
    const pageSize = 2;
    const pagesCount = Math.ceil(expectedResult.length / pageSize);
    for (let i = 0; i < pagesCount; ++i) {
      const pagedDistinctValues = await Presentation.presentation
        .getDistinctValuesIterator({
          imodel: db,
          rulesetOrId: ruleset,
          keys,
          descriptor,
          fieldDescriptor,
          paging: { size: pageSize, start: i * pageSize },
        })
        .then(async (x) => ({ ...x, items: await collect(x.items) }));
      expect(pagedDistinctValues).to.be.deep.equal({
        total: expectedResult.length,
        items: expectedResult.slice(i * pageSize, (i + 1) * pageSize),
      });
    }
  }

  it("gets paged distinct primitive content values", async () => {
    const imodel = await getDefaultSuiteIModel();
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
        },
      ],
    };
    const keys = new KeySet([
      { className: "PCJ_TestSchema:TestClass", id: "0x61" },
      { className: "PCJ_TestSchema:TestClass", id: "0x70" },
      { className: "PCJ_TestSchema:TestClass", id: "0x6a" },
      { className: "PCJ_TestSchema:TestClass", id: "0x3c" },
      { className: "PCJ_TestSchema:TestClass", id: "0x71" },
    ]);
    const descriptor = (await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset, keys, displayType: "" }))!;

    let field = getFieldByLabel(descriptor.fields, "User Label");
    await validatePagedDistinctValuesResponse(imodel, ruleset, keys, descriptor, field.getFieldDescriptor(), [
      {
        displayValue: "TestClass",
        groupedRawValues: ["TestClass"],
      },
    ]);

    field = getFieldByLabel(descriptor.fields, "True-False");
    await validatePagedDistinctValuesResponse(imodel, ruleset, keys, descriptor, field.getFieldDescriptor(), [
      {
        displayValue: "False",
        groupedRawValues: [false],
      },
      {
        displayValue: "True",
        groupedRawValues: [true],
      },
    ]);

    field = getFieldByLabel(descriptor.fields, "<0");
    await validatePagedDistinctValuesResponse(imodel, ruleset, keys, descriptor, field.getFieldDescriptor(), [
      {
        displayValue: "0.00",
        groupedRawValues: [1e-7, 0.0007575],
      },
      {
        displayValue: "0.12",
        groupedRawValues: [0.123456789],
      },
    ]);

    field = getFieldByLabel(descriptor.fields, "<100");
    await validatePagedDistinctValuesResponse(imodel, ruleset, keys, descriptor, field.getFieldDescriptor(), [
      {
        displayValue: "100.01",
        groupedRawValues: [100.01],
      },
      {
        displayValue: "75.75",
        groupedRawValues: [75.75],
      },
      {
        displayValue: "99.01",
        groupedRawValues: [99.01],
      },
    ]);
  });

  it("gets paged distinct related primitive content values", async () => {
    const imodel = await getDefaultSuiteIModel();
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.SelectedNodeInstances,
              relatedProperties: [
                {
                  propertiesSource: [
                    {
                      relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                      direction: RelationshipDirection.Backward,
                    },
                    {
                      relationship: { schemaName: "BisCore", className: "ModelModelsElement" },
                      direction: RelationshipDirection.Forward,
                      targetClass: { schemaName: "BisCore", className: "Element" },
                    },
                  ],
                  properties: [
                    {
                      name: "CodeValue",
                      labelOverride: "Model Label",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const keys = new KeySet([
      { className: "PCJ_TestSchema:TestClass", id: "0x61" },
      { className: "PCJ_TestSchema:TestClass", id: "0x70" },
      { className: "PCJ_TestSchema:TestClass", id: "0x6a" },
      { className: "PCJ_TestSchema:TestClass", id: "0x3c" },
      { className: "PCJ_TestSchema:TestClass", id: "0x71" },
    ]);
    const descriptor = (await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset, keys, displayType: "" }))!;
    const field = getFieldByLabel(descriptor.fields, "Model Label");
    await validatePagedDistinctValuesResponse(imodel, ruleset, keys, descriptor, field.getFieldDescriptor(), [
      {
        displayValue: "Properties_60InstancesWithUrl2",
        groupedRawValues: ["Properties_60InstancesWithUrl2"],
      },
    ]);
  });

  it("gets paged distinct related content values", async () => {
    const imodel = await getDefaultSuiteIModel();
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
        },
      ],
    };
    const keys = new KeySet([
      { className: "PCJ_TestSchema:TestClass", id: "0x61" },
      { className: "PCJ_TestSchema:TestClass", id: "0x70" },
      { className: "PCJ_TestSchema:TestClass", id: "0x6a" },
      { className: "PCJ_TestSchema:TestClass", id: "0x3c" },
      { className: "PCJ_TestSchema:TestClass", id: "0x71" },
    ]);
    const descriptor = (await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset, keys, displayType: "" }))!;
    const field = getFieldByLabel(descriptor.fields, "Name");
    await validatePagedDistinctValuesResponse(imodel, ruleset, keys, descriptor, field.getFieldDescriptor(), [
      {
        displayValue: "Properties_60InstancesWithUrl2.dgn",
        groupedRawValues: ["Properties_60InstancesWithUrl2.dgn"],
      },
    ]);
  });

  it("gets distinct content values using consolidated descriptor", async () => {
    const imodel = await getDefaultSuiteIModel();
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
        },
      ],
    };
    const consolidatedKeys = new KeySet([
      {
        className: "PCJ_TestSchema:TestClass",
        id: Id64.invalid,
      },
      {
        className: "Generic:PhysicalObject",
        id: Id64.invalid,
      },
    ]);
    const descriptor = (await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset, keys: consolidatedKeys, displayType: "" }))!;
    const field = getFieldByLabel(descriptor.fields, "User Label");

    await validatePagedDistinctValuesResponse(imodel, ruleset, consolidatedKeys, descriptor, field.getFieldDescriptor(), [
      {
        displayValue: "",
        groupedRawValues: [undefined],
      },
      {
        displayValue: "TestClass",
        groupedRawValues: ["TestClass"],
      },
    ]);

    const typeOneKey = new KeySet([
      {
        className: "PCJ_TestSchema:TestClass",
        id: Id64.invalid,
      },
    ]);
    await validatePagedDistinctValuesResponse(imodel, ruleset, typeOneKey, descriptor, field.getFieldDescriptor(), [
      {
        displayValue: "TestClass",
        groupedRawValues: ["TestClass"],
      },
    ]);

    const typeTwoKey = new KeySet([
      {
        className: "Generic:PhysicalObject",
        id: Id64.invalid,
      },
    ]);
    await validatePagedDistinctValuesResponse(imodel, ruleset, typeTwoKey, descriptor, field.getFieldDescriptor(), [
      {
        displayValue: "",
        groupedRawValues: [undefined],
      },
    ]);
  });

  it("gets distinct content values based on hierarchy level descriptor", async function () {
    // create an imodel with Model -> Elements relationship
    const testIModel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
      const categoryKey = insertSpatialCategory({ db, codeValue: "Category" });
      const modelKeyA = insertPhysicalModelWithPartition({ db, codeValue: "Model A" });
      insertPhysicalElement({ db, userLabel: "Element A1", modelId: modelKeyA.id, categoryId: categoryKey.id });
      insertPhysicalElement({ db, userLabel: "Element A2", modelId: modelKeyA.id, categoryId: categoryKey.id });
      const modelKeyB = insertPhysicalModelWithPartition({ db, codeValue: "Model B" });
      insertPhysicalElement({ db, userLabel: "Element B", modelId: modelKeyB.id, categoryId: categoryKey.id });
      insertPhysicalElement({ db, userLabel: "Element B", modelId: modelKeyB.id, categoryId: categoryKey.id });
    });

    // set up ruleset
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.RootNodes,
          specifications: [
            {
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: [
                {
                  schemaName: "BisCore",
                  classNames: ["PhysicalModel"],
                  arePolymorphic: false,
                },
              ],
              groupByClass: false,
              groupByLabel: false,
            },
          ],
        },
        {
          ruleType: RuleTypes.ChildNodes,
          condition: `ParentNode.IsOfClass("Model", "BisCore")`,
          specifications: [
            {
              specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
              relationshipPaths: [
                {
                  relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                  direction: "Forward",
                },
              ],
              groupByClass: false,
              groupByLabel: false,
            },
          ],
        },
      ],
    };
    const rootNodes = await Presentation.presentation.getNodesIterator({ imodel: testIModel, rulesetOrId: ruleset }).then(async (x) => collect(x.items));
    expect(rootNodes.length).to.eq(2);
    const descriptor = await Presentation.presentation.getNodesDescriptor({ imodel: testIModel, rulesetOrId: ruleset, parentKey: rootNodes[0].key });
    assert(!!descriptor);

    // ensure descriptor contains the ruleset used to create it
    expect(descriptor.ruleset!.rules).to.deep.equal([
      {
        ruleType: "Content",
        specifications: [
          {
            specType: "ContentRelatedInstances",
            relationshipPaths: [
              {
                relationship: {
                  schemaName: "BisCore",
                  className: "ModelContainsElements",
                },
                direction: "Forward",
              },
            ],
          },
        ],
      },
    ]);

    const userLabelField = getFieldByLabel(descriptor.fields, "User Label");
    // user labels are different for every child element, expect 2 unique values
    await validatePagedDistinctValuesResponse(testIModel, descriptor.ruleset!, new KeySet([rootNodes[0].key]), {}, userLabelField.getFieldDescriptor(), [
      {
        displayValue: "Element A1",
        groupedRawValues: ["Element A1"],
      },
      {
        displayValue: "Element A2",
        groupedRawValues: ["Element A2"],
      },
    ]);

    // user label is the same for every child element, expect only 1 unique value
    await validatePagedDistinctValuesResponse(testIModel, descriptor.ruleset!, new KeySet([rootNodes[1].key]), {}, userLabelField.getFieldDescriptor(), [
      {
        displayValue: "Element B",
        groupedRawValues: ["Element B"],
      },
    ]);
  });

  it("filters distinct content values using descriptor's instance filter", async function () {
    const testIModel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
      insertDocumentPartition(db, "A", "A");
      insertDocumentPartition(db, "B1", "B");
      insertDocumentPartition(db, "B2", "B");
    });

    // set up ruleset
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: {
                schemaName: "BisCore",
                classNames: ["DocumentPartition"],
              },
            },
          ],
        },
      ],
    };

    const descriptor = await Presentation.presentation.getContentDescriptor({
      imodel: testIModel,
      rulesetOrId: ruleset,
      keys: new KeySet(),
      displayType: "",
    });
    assert(!!descriptor);

    const userLabelField = getFieldByLabel(descriptor.fields, "User Label");
    descriptor.instanceFilter = { expression: 'this.UserLabel = "B"', selectClassName: "BisCore:DocumentPartition" };
    await validatePagedDistinctValuesResponse(testIModel, ruleset, new KeySet(), descriptor, userLabelField.getFieldDescriptor(), [
      {
        displayValue: "B",
        groupedRawValues: ["B"],
      },
    ]);
  });

  it("filters distinct content values using descriptor's fields filter", async function () {
    const testIModel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
      insertDocumentPartition(db, "A", "A");
      insertDocumentPartition(db, "B1", "B");
      insertDocumentPartition(db, "B2", "B");
    });

    // set up ruleset
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: {
                schemaName: "BisCore",
                classNames: ["DocumentPartition"],
              },
            },
          ],
        },
      ],
    };

    const descriptor = await Presentation.presentation.getContentDescriptor({
      imodel: testIModel,
      rulesetOrId: ruleset,
      keys: new KeySet(),
      displayType: "",
    });
    assert(!!descriptor);

    const userLabelField = getFieldByLabel(descriptor.fields, "User Label");
    descriptor.fieldsFilterExpression = `${userLabelField.name} = "B"`;
    await validatePagedDistinctValuesResponse(testIModel, ruleset, new KeySet(), descriptor, userLabelField.getFieldDescriptor(), [
      {
        displayValue: "B",
        groupedRawValues: ["B"],
      },
    ]);
  });
});
