/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid, using } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { Content, ContentSpecificationTypes, DefaultContentDisplayTypes, InstanceKey, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { PresentationManager } from "@itwin/presentation-frontend";
import {
  buildTestIModelConnection,
  importSchema,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
} from "../../IModelSetupUtils";
import { collect, getFieldByLabel } from "../../Utils";
import { describeContentTestSuite, getDisplayValue } from "./Utils";

describeContentTestSuite("Array properties", () => {
  const ruleset: Ruleset = {
    id: Guid.createValue(),
    rules: [
      {
        ruleType: RuleTypes.Content,
        specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
      },
    ],
  };

  it("returns content for arrays with null items", async function () {
    let elementKey!: InstanceKey;
    const imodel = await buildTestIModelConnection(this.test!.title, async (db) => {
      const schema = importSchema(
        this,
        db,
        `
          <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
          <ECEntityClass typeName="X">
            <BaseClass>bis:PhysicalElement</BaseClass>
            <ECArrayProperty propertyName="Prop" typeName="string" />
          </ECEntityClass>
        `,
      );
      const model = insertPhysicalModelWithPartition({ db, codeValue: "model" });
      const category = insertSpatialCategory({ db, codeValue: "category" });
      elementKey = insertPhysicalElement({
        db,
        classFullName: schema.items.X.fullName,
        modelId: model.id,
        categoryId: category.id,
        ["Prop"]: [undefined, "test"],
      });
    });
    const content = await getContent(imodel, elementKey);
    const field = getFieldByLabel(content.descriptor.fields, "Prop");
    const displayValue = getDisplayValue(content, [field]);
    expect(displayValue).to.deep.eq([undefined, "test"]);
  });

  async function getContent(imodel: IModelConnection, key: InstanceKey): Promise<Content> {
    const keys = new KeySet([key]);
    return using(PresentationManager.create(), async (manager) => {
      const descriptor = await manager.getContentDescriptor({
        imodel,
        rulesetOrId: ruleset,
        keys,
        displayType: DefaultContentDisplayTypes.Grid,
      });
      expect(descriptor).to.not.be.undefined;
      const content = await manager
        .getContentIterator({ imodel, rulesetOrId: ruleset, keys, descriptor: descriptor! })
        .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));
      expect(content).to.not.be.undefined;
      return content!;
    });
  }
});
