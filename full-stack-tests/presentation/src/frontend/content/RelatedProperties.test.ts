/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { Content, ContentSpecificationTypes, InstanceKey, KeySet, NestedContentField, NestedContentValue, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { collect, getContentValues, getFieldByLabel, getFieldsByLabel } from "../../Utils.js";
import { describeContentTestSuite } from "./Utils.js";
import { buildTestIModelConnection, importSchema, insertElementAspect, insertPhysicalPartition } from "../../IModelSetupUtils.js";

describeContentTestSuite("Related Properties", () => {
  it("creates related fields using same relationship but different instance filter", async function () {
    const rootSubjectId = "0x1";
    const partitionKeys: InstanceKey[] = [];
    const imodelConnection = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
      const p1 = insertPhysicalPartition({ db, codeValue: "partition1", parentId: rootSubjectId });
      const p2 = insertPhysicalPartition({ db, codeValue: "partition2", parentId: rootSubjectId });
      partitionKeys.push(p1, p2);
    });

    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "BisCore", classNames: ["Subject"] },
              instanceFilter: `this.ECInstanceId = 1`,
            },
          ],
        },
        {
          ruleType: RuleTypes.ContentModifier,
          class: { schemaName: "BisCore", className: "Subject" },
          relatedProperties: [
            {
              propertiesSource: {
                relationship: { schemaName: "BisCore", className: "SubjectOwnsPartitionElements" },
                direction: "Forward",
              },
              instanceFilter: `this.ECInstanceId = ${partitionKeys[0].id}`,
              properties: [
                {
                  name: "CodeValue"
                }
              ]
            },
          ],
        },
        {
          ruleType: RuleTypes.ContentModifier,
          class: { schemaName: "BisCore", className: "Subject" },
          relatedProperties: [
            {
              propertiesSource: {
                relationship: { schemaName: "BisCore", className: "SubjectOwnsPartitionElements" },
                direction: "Forward",
              },
              instanceFilter: `this.ECInstanceId = ${partitionKeys[1].id}`,
              properties: [
                {
                  name: "CodeValue"
                }
              ]
            },
          ],
        },
      ],
    };

    const content = await Presentation.presentation
      .getContentIterator({
        imodel: imodelConnection,
        rulesetOrId: ruleset,
        descriptor: {},
        keys: new KeySet(),
      })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));

    const partitionFields = getFieldsByLabel(content!.descriptor.fields, "Information Partition");
    expect(partitionFields.length).to.eq(2);

    const codeValueField1 = getFieldByLabel((partitionFields[0] as NestedContentField).nestedFields, "Code");
    expect((content?.contentSet[0].values[partitionFields[0].name] as NestedContentValue[])[0]).to.containSubset({
      primaryKeys: [
        partitionKeys[0],
      ],
      values: {
        [codeValueField1.name]: "partition1",
      },
    });

    const codeValueField2 = getFieldByLabel((partitionFields[1] as NestedContentField).nestedFields, "Code");
    expect((content?.contentSet[0].values[partitionFields[1].name] as NestedContentValue[])[0]).to.containSubset({
      primaryKeys: [
        partitionKeys[1],
      ],
      values: {
        [codeValueField2.name]: "partition2",
      },
    });
  });

  it.only("loads aspect properties of one-to-many related elements", async function () {
    const rootSubjectId = "0x1";
    const partitionKeys: InstanceKey[] = [];
    const imodelConnection = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
      const schema = importSchema(
        this,
        db,
        `
          <ECSchemaReference name="BisCore" version="1.0.0" alias="bis"/>
          <ECEntityClass typeName="TestAspect">
            <BaseClass>bis:ElementMultiAspect</BaseClass>
            <ECProperty propertyName="AspectProperty" typeName="string" />
          </ECEntityClass>
        `,
      );
      const p1 = insertPhysicalPartition({ db, codeValue: "partition1", parentId: rootSubjectId });
      insertElementAspect({
        db,
        elementId: p1.id,
        classFullName: schema.items.TestAspect.fullName,
        aspectProperty: "one",
      });
      const p2 = insertPhysicalPartition({ db, codeValue: "partition2", parentId: rootSubjectId });
      insertElementAspect({
        db,
        elementId: p2.id,
        classFullName: schema.items.TestAspect.fullName,
        aspectProperty: "two",
      });
      partitionKeys.push(p1, p2);
    });

    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.SelectedNodeInstances,
            },
          ],
        },
        {
          ruleType: RuleTypes.ContentModifier,
          class: { schemaName: "BisCore", className: "Subject" },
          relatedProperties: [
            {
              propertiesSource: {
                relationship: { schemaName: "BisCore", className: "SubjectOwnsPartitionElements" },
                direction: "Forward",
              },
            },
          ],
        },
      ],
    };

    const content = await Presentation.presentation
      .getContentIterator({
        imodel: imodelConnection,
        rulesetOrId: ruleset,
        descriptor: {},
        keys: new KeySet([{ className: "BisCore:Subject", id: rootSubjectId }]),
      })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));
    assert(!!content);

    const aspectPropertyField = getFieldByLabel(content.descriptor.fields, "AspectProperty");
    const values = getContentValues({ content, field: aspectPropertyField });
    expect(values).to.deep.eq(["one", "two"]);
  });
});
