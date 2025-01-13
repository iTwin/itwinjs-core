/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import faker from "faker";
import fs from "fs";
import { IModelDb, StandaloneDb, Subject } from "@itwin/core-backend";
import { Id64, Logger, LogLevel } from "@itwin/core-bentley";
import { Presentation, RulesetEmbedder } from "@itwin/presentation-backend";
import { ChildNodeSpecificationTypes, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { createRandomRuleset } from "@itwin/presentation-common/lib/cjs/test";
import { initialize, terminate } from "../IntegrationTests";
import { prepareOutputFilePath } from "../Utils";
import { IModel, SubjectProps } from "@itwin/core-common";

const RULESET_1: Ruleset = {
  id: "ruleset_1",
  rules: [
    {
      ruleType: RuleTypes.RootNodes,
      specifications: [
        {
          specType: ChildNodeSpecificationTypes.CustomNode,
          type: "test 1",
          label: "label 1",
        },
      ],
    },
  ],
};

describe("RulesEmbedding", () => {
  let imodel: IModelDb;
  let embedder: RulesetEmbedder;
  let ruleset: Ruleset;

  before(async () => {
    await initialize();
    Logger.setLevel("BeSQLite", LogLevel.Info);
  });

  after(async () => {
    await terminate();
  });

  beforeEach(async () => {
    const imodelPath = prepareOutputFilePath("RulesetEmbedding.bim");
    imodel = StandaloneDb.createEmpty(imodelPath, {
      rootSubject: {
        name: "presentation-full-stack-tests/RulesetEmbedding",
      },
    });
    embedder = new RulesetEmbedder({ imodel });
    ruleset = {
      id: "test-ruleset",
      rules: [],
    };
  });

  afterEach(async () => {
    const imodelPath = imodel.pathName;
    imodel.close();
    fs.unlinkSync(imodelPath);
  });

  it("handles getting rulesets with nothing inserted", async () => {
    const rulesets: Ruleset[] = await embedder.getRulesets();
    expect(rulesets.length).equal(0);
  });

  it("inserts a ruleset to iModel and retrieves it", async () => {
    // Insert a ruleset
    const insertId = await embedder.insertRuleset(ruleset);
    expect(Id64.isValid(insertId)).true;

    // Obtain all rulesets
    const rulesets: Ruleset[] = await embedder.getRulesets();
    expect(rulesets.length).equals(1);

    expect(ruleset).to.deep.eq(rulesets[0]);
  });

  it("inserts a ruleset under specified parent subject", async () => {
    // Setup ruleset subject
    const subjectProps: SubjectProps = {
      classFullName: Subject.classFullName,
      code: Subject.createCode(imodel, IModel.rootSubjectId, "test-ruleset-subject"),
      model: IModel.repositoryModelId,
      parent: {
        id: IModel.rootSubjectId,
        relClassName: "bis.SubjectOwnsSubjects",
      },
    };
    const parentSubjectId = imodel.elements.insertElement(subjectProps);

    // Insert a ruleset into custom subject
    const ruleset1 = { id: "1", rules: [] };
    embedder = new RulesetEmbedder({ imodel, parentSubjectId });
    const rulesetId1 = await embedder.insertRuleset(ruleset1);
    expect(Id64.isValid(rulesetId1)).true;

    // Obtain all rulesets
    const rulesets: Ruleset[] = await embedder.getRulesets();
    expect(rulesets.sort((a, b) => a.id.localeCompare(b.id))).to.deep.eq([ruleset1]);

    // Validate if ruleset subject has been created under the correct subject
    const reader = imodel.createQueryReader("SELECT Parent.Id parentId FROM bis.Subject WHERE CodeValue = 'PresentationRules'");
    const row = await reader.next();
    expect(row.value.parentId).to.eq(parentSubjectId);
  });

  it("inserts multiple different rulesets to iModel", async () => {
    // Create another ruleset
    const otherRuleset = { ...(await createRandomRuleset()), id: `${ruleset.id}_different` };

    // Insert a ruleset
    const insertId1 = await embedder.insertRuleset(ruleset);
    const insertId2 = await embedder.insertRuleset(otherRuleset);
    expect(Id64.isValid(insertId1)).true;
    expect(Id64.isValid(insertId2)).true;

    // Obtain all rulesets
    const rulesets: Ruleset[] = await embedder.getRulesets();
    expect(rulesets.length).equals(2);

    const actualRuleset = rulesets.find((value: Ruleset, _index: number, _obj: Ruleset[]): boolean => value.id === ruleset.id);
    expect(actualRuleset).to.not.be.undefined;
    expect(ruleset).to.deep.eq(actualRuleset as Ruleset);

    const actualOtherRuleset = rulesets.find((value: Ruleset, _index: number, _obj: Ruleset[]): boolean => value.id === otherRuleset.id);
    expect(actualOtherRuleset).to.not.be.undefined;
    expect(otherRuleset).to.deep.eq(actualOtherRuleset as Ruleset);
  });

  it("locates rulesets", async () => {
    // Create a ruleset and insert it
    const insertId = await embedder.insertRuleset(RULESET_1);
    expect(Id64.isValid(insertId)).true;

    // Try getting root node to confirm embedded ruleset is being located
    const rootNodes = await Presentation.getManager().getNodes({ imodel, rulesetOrId: RULESET_1.id });
    expect(rootNodes.length).to.be.equal(1);
  });

  it("locates rulesets correctly if rules are updated", async () => {
    // Create a ruleset and insert it
    const insertId = await embedder.insertRuleset(RULESET_1);
    expect(Id64.isValid(insertId)).true;

    // Try getting root node to confirm embedded ruleset is being located
    let rootNodes = await Presentation.getManager().getNodes({ imodel, rulesetOrId: RULESET_1.id });
    expect(rootNodes.length).to.be.equal(1);

    const rulesetElement = imodel.elements.getElement(insertId);
    rulesetElement.setJsonProperty("id", faker.random.uuid());
    imodel.elements.updateElement(rulesetElement.toJSON());

    rootNodes = await Presentation.getManager().getNodes({ imodel, rulesetOrId: RULESET_1.id });
    expect(rootNodes.length).to.be.equal(1);
  });

  it("does not insert same ruleset to iModel multiple times", async () => {
    // Insert a ruleset
    const insertId1 = await embedder.insertRuleset(ruleset);
    const insertId2 = await embedder.insertRuleset(ruleset);
    expect(Id64.isValid(insertId1)).true;
    expect(insertId1).to.be.equal(insertId2);
    // Obtain all rulesets
    const rulesets: Ruleset[] = await embedder.getRulesets();
    expect(rulesets.length).equals(1);
  });

  it("skips inserting duplicate ruleset with same id", async () => {
    const ruleset1: Ruleset = { id: "test", version: "1.2.3", rules: [] };
    const insertId1 = await embedder.insertRuleset(ruleset1);
    expect(Id64.isValid(insertId1)).to.be.true;

    const ruleset2: Ruleset = { id: "test", version: "4.5.6", rules: [] };
    const insertId2 = await embedder.insertRuleset(ruleset2, { skip: "same-id" });
    expect(insertId2).to.eq(insertId1);

    const rulesets = await embedder.getRulesets();
    expect(rulesets.length).to.eq(1);
    expect(rulesets[0]).to.deep.eq(ruleset1);
  });

  it("skips inserting duplicate ruleset with same id and version", async () => {
    const ruleset1: Ruleset = { id: "test", version: "1.2.3", rules: [] };
    const insertId1 = await embedder.insertRuleset(ruleset1);
    expect(Id64.isValid(insertId1)).to.be.true;

    const ruleset2: Ruleset = { id: "test", version: "1.2.3", rules: [] };
    const insertId2 = await embedder.insertRuleset(ruleset2, { skip: "same-id-and-version-eq" });
    expect(insertId2).to.eq(insertId1);

    const rulesets = await embedder.getRulesets();
    expect(rulesets.length).to.eq(1);
    expect(rulesets[0]).to.deep.eq(ruleset1);
  });

  it("doesn't skip inserting duplicate ruleset with same id if versions are different", async () => {
    const ruleset1: Ruleset = { id: "test", version: "1.2.3", rules: [] };
    const insertId1 = await embedder.insertRuleset(ruleset1);
    expect(Id64.isValid(insertId1)).to.be.true;

    const ruleset2: Ruleset = { id: "test", version: "4.5.6", rules: [] };
    const insertId2 = await embedder.insertRuleset(ruleset2, { skip: "same-id-and-version-eq" });
    expect(insertId2).to.not.eq(insertId1);

    const rulesets = await embedder.getRulesets();
    expect(rulesets.length).to.eq(2);
    expect(rulesets[0]).to.deep.eq(ruleset1);
    expect(rulesets[1]).to.deep.eq(ruleset2);
  });

  it("replaces all rulesets with same id", async () => {
    const ruleset1: Ruleset = { id: "test", version: "1.0.0", rules: [] };
    const insertId1 = await embedder.insertRuleset(ruleset1);
    expect(Id64.isValid(insertId1)).to.be.true;

    const ruleset2: Ruleset = { id: "test", version: "3.0.0", rules: [] };
    const insertId2 = await embedder.insertRuleset(ruleset2);
    expect(Id64.isValid(insertId2)).to.be.true;

    const ruleset3: Ruleset = { id: "test", version: "2.0.0", rules: [] };
    const insertId3 = await embedder.insertRuleset(ruleset3, { replaceVersions: "all" });
    expect(insertId3).to.not.be.oneOf([insertId1, insertId2]);

    const rulesets = await embedder.getRulesets();
    expect(rulesets.length).to.eq(1);
    expect(rulesets[0]).to.deep.eq(ruleset3);
  });

  it("replaces older rulesets with same id", async () => {
    const ruleset1: Ruleset = { id: "test", version: "1.0.0", rules: [] };
    const insertId1 = await embedder.insertRuleset(ruleset1);
    expect(Id64.isValid(insertId1)).to.be.true;

    const ruleset2: Ruleset = { id: "test", version: "3.0.0", rules: [] };
    const insertId2 = await embedder.insertRuleset(ruleset2);
    expect(Id64.isValid(insertId2)).to.be.true;

    const ruleset3: Ruleset = { id: "test", version: "2.0.0", rules: [] };
    const insertId3 = await embedder.insertRuleset(ruleset3, { replaceVersions: "all-lower" });
    expect(insertId3).to.not.be.oneOf([insertId1, insertId2]);

    const rulesets = await embedder.getRulesets();
    expect(rulesets.length).to.eq(2);
    expect(rulesets[0]).to.deep.eq(ruleset2);
    expect(rulesets[1]).to.deep.eq(ruleset3);
  });

  it("replaces rulesets with same id and version", async () => {
    const ruleset1: Ruleset = { id: "test", version: "1.0.0", rules: [] };
    const insertId1 = await embedder.insertRuleset(ruleset1);
    expect(Id64.isValid(insertId1)).to.be.true;

    const ruleset2: Ruleset = { id: "test", version: "3.0.0", rules: [{ ruleType: RuleTypes.Content, specifications: [] }] };
    const insertId2 = await embedder.insertRuleset(ruleset2);
    expect(Id64.isValid(insertId2)).to.be.true;

    const ruleset3: Ruleset = { id: "test", version: "3.0.0", rules: [{ ruleType: RuleTypes.RootNodes, specifications: [] }] };
    const insertId3 = await embedder.insertRuleset(ruleset3, { skip: "never", replaceVersions: "exact" });
    expect(insertId3).to.eq(insertId2).not.eq(insertId1);

    const rulesets = await embedder.getRulesets();
    expect(rulesets.length).to.eq(2);
    expect(rulesets[0]).to.deep.eq(ruleset1);
    expect(rulesets[1]).to.deep.eq(ruleset3);
  });
});
