/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
import { BisCoreSchema, DefinitionModel, DefinitionPartition, IModelDb, KnownLocations, Subject } from "@itwin/core-backend";
import { Id64String } from "@itwin/core-bentley";
import { BisCodeSpec, Code, CodeScopeSpec, CodeSpec, IModel, QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { Ruleset } from "@itwin/presentation-common";
import { PresentationRules } from "../presentation-backend/domain/PresentationRulesDomain.js";
import * as RulesetElements from "../presentation-backend/domain/RulesetElements.js";
import { RulesetEmbedder } from "../presentation-backend/RulesetEmbedder.js";
import { normalizeVersion } from "../presentation-backend/Utils.js";
import { stubECSqlReader } from "./Helpers.js";

describe("RulesetEmbedder", () => {
  const sandbox = sinon.createSandbox();
  let embedder: RulesetEmbedder;

  // ids
  const rootSubjectId = "0x1";
  const presentationRulesSubjectId = "0x123";
  const definitionPartitionId = "0x456";
  const modelId = "0x789";

  const rulesetCodeSpec = CodeSpec.create({} as unknown as IModel, PresentationRules.CodeSpec.Ruleset, CodeScopeSpec.Type.Model);
  const subjectCodeSpec = createCodeSpecWithId({ id: "0x999", specName: BisCodeSpec.subject, scopeType: CodeScopeSpec.Type.ParentElement });
  const informationPartitionCodeSpec = createCodeSpecWithId({
    id: "0x888",
    specName: BisCodeSpec.informationPartitionElement,
    scopeType: CodeScopeSpec.Type.ParentElement,
  });

  // elements/models
  const rootSubjectMock = {
    insert: sandbox.stub(),
    id: rootSubjectId,
    model: modelId,
  };
  const presentationRulesSubjectMock = {
    insert: sandbox.stub(),
    id: presentationRulesSubjectId,
    model: modelId,
  };
  const definitionPartitionMock = {
    insert: sandbox.stub(),
    id: definitionPartitionId,
    model: modelId,
  };
  const rulesetModelMock = {
    insert: sandbox.stub(),
    id: modelId,
    model: modelId,
  };

  let imodelMock: ReturnType<typeof stubIModel>;
  let imodel: IModelDb;

  const onEntityUpdate = {
    onBeforeUpdate: sandbox.spy(),
    onAfterUpdate: sandbox.spy(),
  };

  const onEntityInsert = {
    onBeforeInsert: sandbox.spy(),
    onAfterInsert: sandbox.spy(),
  };

  beforeEach(async () => {
    sandbox.stub(KnownLocations, "nativeAssetsDir").get(() => "");
    BisCoreSchema.registerSchema();

    imodelMock = stubIModel();
    imodel = imodelMock as unknown as IModelDb;

    rootSubjectMock.insert.returns(rootSubjectId);
    presentationRulesSubjectMock.insert.returns(presentationRulesSubjectId);
    definitionPartitionMock.insert.returns(definitionPartitionId);
    rulesetModelMock.insert.returns(modelId);

    rulesetCodeSpec.iModel = imodel;
    subjectCodeSpec.iModel = imodel;
    informationPartitionCodeSpec.iModel = imodel;

    embedder = new RulesetEmbedder({ imodel });
  });

  afterEach(() => {
    sandbox.reset();
  });

  function createCodeSpecWithId(props: { id: Id64String; specName: string; scopeType: CodeScopeSpec.Type }): CodeSpec {
    const { id, specName, scopeType } = props;
    const spec = CodeSpec.create({} as unknown as IModel, specName, scopeType);
    spec.id = id;
    return spec;
  }

  function stubIModel() {
    const mock = {
      containsClass: sandbox.stub().returns(false),
      importSchemas: sandbox.stub().resolves(undefined),
      createQueryReader: sandbox.stub(),
      saveChanges: sandbox.stub(),
      codeSpecs: {
        getByName: sandbox.stub(),
        hasName: sandbox.stub().returns(false),
        insert: sandbox.stub().returns(""),
      },
      elements: {
        createElement: sandbox.stub(),
        deleteElement: sandbox.stub(),
        getElement: sandbox.stub(),
        insertElement: sandbox.stub(),
        tryGetElement: sandbox.stub(),
      },
      models: {
        createModel: sandbox.stub(),
        getSubModel: sandbox.stub(),
      },
    };

    mock.codeSpecs.getByName.withArgs(PresentationRules.CodeSpec.Ruleset).returns(rulesetCodeSpec);
    mock.codeSpecs.getByName.withArgs(BisCodeSpec.subject).returns(subjectCodeSpec);
    mock.codeSpecs.getByName.withArgs(BisCodeSpec.informationPartitionElement).returns(informationPartitionCodeSpec);

    mock.elements.getElement.withArgs(IModel.rootSubjectId).returns(rootSubjectMock);

    return mock;
  }

  function setupMocksForHandlingPrerequisites() {
    imodelMock.codeSpecs.insert.withArgs(rulesetCodeSpec).returns("0x2025");
  }

  function setupMocksForGettingRulesetModel() {
    imodelMock.containsClass.withArgs(RulesetElements.Ruleset.classFullName).returns(true);
    imodelMock.models.getSubModel.withArgs(definitionPartitionId).returns(rulesetModelMock);
    imodelMock.elements.tryGetElement
      .withArgs(new Code({ spec: subjectCodeSpec.id, scope: rootSubjectId, value: "PresentationRules" }))
      .returns(presentationRulesSubjectMock);
    imodelMock.elements.tryGetElement
      .withArgs(DefinitionPartition.createCode(imodel, presentationRulesSubjectId, "PresentationRules"))
      .returns(definitionPartitionMock);
  }

  function setupMocksForCreatingRulesetModel() {
    imodelMock.containsClass.withArgs(RulesetElements.Ruleset.classFullName).returns(true);
    imodelMock.elements.tryGetElement.withArgs(new Code({ spec: subjectCodeSpec.id, scope: rootSubjectId, value: "PresentationRules" })).returns(undefined);
    imodelMock.elements.getElement.withArgs(presentationRulesSubjectId).returns(presentationRulesSubjectMock);
    imodelMock.elements.getElement.withArgs(definitionPartitionId).returns(definitionPartitionMock);

    const createSubjectProps = {
      classFullName: Subject.classFullName,
      model: modelId,
      code: new Code({
        spec: subjectCodeSpec.id,
        scope: rootSubjectId,
        value: "PresentationRules",
      }),
      parent: {
        id: rootSubjectId,
        relClassName: "BisCore:SubjectOwnsSubjects",
      },
    };
    imodelMock.elements.createElement.withArgs(createSubjectProps).returns(presentationRulesSubjectMock);

    const createPartitionProps = {
      parent: {
        id: presentationRulesSubjectId,
        relClassName: "BisCore:SubjectOwnsPartitionElements",
      },
      model: modelId,
      code: DefinitionPartition.createCode(imodel, presentationRulesSubjectId, "PresentationRules"),
      classFullName: DefinitionPartition.classFullName,
    };
    imodelMock.elements.createElement.withArgs(createPartitionProps).returns(definitionPartitionMock);

    const createModelProps = {
      modeledElement: definitionPartitionMock,
      name: "PresentationRules",
      classFullName: DefinitionModel.classFullName,
      isPrivate: true,
    };
    imodelMock.models.createModel.withArgs(createModelProps).returns(rulesetModelMock);
  }

  function setupMocksForQueryingExistingRulesets(rulesetId: string, rulesets: Array<{ ruleset: Ruleset; elementId: Id64String }>) {
    const results = rulesets.map((entry) => ({
      id: entry.elementId,
      jsonProperties: JSON.stringify({ jsonProperties: entry.ruleset }),
      normalizedVersion: normalizeVersion(entry.ruleset.version),
    }));
    imodelMock.createQueryReader
      .withArgs(sinon.match.any, QueryBinder.from({ rulesetId }), { rowFormat: QueryRowFormat.UseJsPropertyNames })
      .returns(stubECSqlReader(results));
  }

  function setupMocksForInsertingNewRuleset(ruleset: Ruleset, rulesetElementId: string) {
    const definitionElementMock = {
      id: rulesetElementId,
      insert: sandbox.stub().returns(rulesetElementId),
    };
    imodelMock.elements.createElement
      .withArgs({
        model: modelId,
        code: RulesetElements.Ruleset.createRulesetCode(imodel, modelId, ruleset),
        classFullName: RulesetElements.Ruleset.classFullName,
        jsonProperties: { jsonProperties: ruleset },
      })
      .returns(definitionElementMock);
    imodelMock.elements.getElement.withArgs(rulesetElementId).returns(definitionElementMock);
  }

  describe("insertRuleset", () => {
    it("sets up prerequisites when inserting element", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "0x111";

      setupMocksForHandlingPrerequisites();
      setupMocksForCreatingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", []);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);
      imodelMock.containsClass.withArgs(RulesetElements.Ruleset.classFullName).returns(false);

      await embedder.insertRuleset(ruleset);

      expect(imodelMock.importSchemas).to.be.calledOnce;
      expect(imodelMock.codeSpecs.insert).to.be.calledOnce;
      expect(rulesetModelMock.insert).to.be.calledOnce;
      expect(imodelMock.saveChanges).to.have.callCount(2);
    });

    it("sets up prerequisites when inserting element and prerequisites are partially available", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "0x111";

      // mock that ruleset schema is present
      imodelMock.containsClass.withArgs(RulesetElements.Ruleset.classFullName).returns(true);
      // mock that ruleset CodeSpec is not present
      imodelMock.codeSpecs.hasName.withArgs(PresentationRules.CodeSpec.Ruleset).returns(false);
      imodelMock.codeSpecs.insert.withArgs(rulesetCodeSpec).returns("0x2025");

      setupMocksForCreatingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", []);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      await embedder.insertRuleset(ruleset);

      expect(imodelMock.importSchemas).to.not.have.been.called;
      expect(imodelMock.codeSpecs.insert).to.be.calledOnceWith(rulesetCodeSpec);
      expect(rulesetModelMock.insert).to.be.calledOnce;
      expect(imodelMock.saveChanges).to.have.callCount(2);
    });

    it("calls `onElementInsert` and `onModelInsert` callbacks when creating RulesetModel", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "0x111";

      setupMocksForCreatingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", []);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      await embedder.insertRuleset(ruleset, { onEntityInsert });

      expect(onEntityInsert.onBeforeInsert.callCount).to.eq(4);
      expect(onEntityInsert.onAfterInsert.callCount).to.eq(4);
    });

    it("inserts a single ruleset", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "0x111";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", []);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      const insertId = await embedder.insertRuleset(ruleset, { onEntityInsert });
      expect(insertId).to.eq(rulesetElementId);
      expect(onEntityInsert.onBeforeInsert).to.have.been.calledOnce;
      expect(onEntityInsert.onAfterInsert).to.have.been.calledOnce;
    });

    it("inserts into model under specified parent subject id", async () => {
      const ruleset: Ruleset = { id: "test", version: "4.5.6", rules: [] };
      const parentSubjectId = "0x111";
      const rulesetElementId = "0x222";

      imodelMock.elements.getElement.withArgs(parentSubjectId).returns(rootSubjectMock);
      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", []);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      embedder = new RulesetEmbedder({ imodel, parentSubjectId });
      const insertId = await embedder.insertRuleset(ruleset, { onEntityInsert });
      expect(insertId).to.eq(rulesetElementId);
      expect(onEntityInsert.onBeforeInsert).to.be.calledOnce;
      expect(onEntityInsert.onAfterInsert).to.be.calledOnce;
    });

    it("creates missing subject, partition and model under specified parent subject id", async () => {
      const ruleset: Ruleset = { id: "test", version: "4.5.6", rules: [] };
      const parentSubjectId = "0x111";
      const rulesetElementId = "0x222";

      imodelMock.elements.getElement.withArgs(parentSubjectId).returns(rootSubjectMock);
      setupMocksForCreatingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", []);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      embedder = new RulesetEmbedder({ imodel, parentSubjectId });
      const insertId = await embedder.insertRuleset(ruleset, { onEntityInsert });
      expect(insertId).to.eq(rulesetElementId);
      expect(onEntityInsert.onBeforeInsert).to.have.callCount(4);
      expect(onEntityInsert.onAfterInsert).to.have.callCount(4);
    });

    it("throws error if specified parent subject id is not found", async () => {
      const ruleset: Ruleset = { id: "test", version: "4.5.6", rules: [] };
      const parentSubjectId = "0x111";
      const rulesetElementId = "0x222";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", []);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      embedder = new RulesetEmbedder({ imodel, parentSubjectId });
      await expect(embedder.insertRuleset(ruleset, { onEntityInsert })).to.be.rejected;
      expect(onEntityInsert.onBeforeInsert).not.to.be.called;
      expect(onEntityInsert.onAfterInsert).not.to.be.called;
    });

    it("skips inserting ruleset with same id", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "0x111";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", [
        {
          ruleset,
          elementId: rulesetElementId,
        },
      ]);

      const insertId = await embedder.insertRuleset(ruleset, { skip: "same-id" });
      expect(insertId).to.eq(rulesetElementId);
      expect(imodelMock.elements.insertElement).to.not.have.been.called;
    });

    it("doesn't skip inserting ruleset with different id", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "0x111";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", []);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      const insertId = await embedder.insertRuleset(ruleset, { skip: "same-id" });
      expect(insertId).to.eq(rulesetElementId);
    });

    it("skips inserting ruleset with same id and version", async () => {
      const ruleset: Ruleset = { id: "test", version: "1.2.3", rules: [] };
      const rulesetElementId = "0x111";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", [
        {
          ruleset,
          elementId: rulesetElementId,
        },
      ]);

      const insertId = await embedder.insertRuleset(ruleset, { skip: "same-id-and-version-eq" });
      expect(insertId).to.eq(rulesetElementId);
      expect(imodelMock.elements.insertElement).to.not.have.been.called;
    });

    it("doesn't skip inserting ruleset with same id and different version", async () => {
      const ruleset: Ruleset = { id: "test", version: "1.2.3", rules: [] };
      const rulesetElementId = "0x111";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", [
        {
          ruleset: { ...ruleset, version: "4.5.6" },
          elementId: "0x456",
        },
      ]);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      const insertId = await embedder.insertRuleset(ruleset, { skip: "same-id-and-version-eq" });
      expect(insertId).to.eq(rulesetElementId);
    });

    it("skips inserting ruleset with same id and lower version", async () => {
      const ruleset: Ruleset = { id: "test", version: "1.2.3", rules: [] };

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", [
        {
          ruleset: { id: "test", version: "1.2.3", rules: [] },
          elementId: "0x111",
        },
        {
          ruleset: { id: "test", version: "4.5.6", rules: [] },
          elementId: "0x222",
        },
        {
          ruleset: { id: "test", version: "7.8.9", rules: [] },
          elementId: "0x333",
        },
      ]);

      const insertId = await embedder.insertRuleset(ruleset, { skip: "same-id-and-version-gte" });
      expect(insertId).to.eq("0x333");
      expect(imodelMock.elements.insertElement).to.not.have.been.called;
    });

    it("doesn't skip inserting ruleset with same id and higher version", async () => {
      const ruleset: Ruleset = { id: "test", version: "4.5.6", rules: [] };
      const rulesetElementId = "0x222";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", [
        {
          ruleset: { id: "test", version: "1.2.3", rules: [] },
          elementId: "0x111",
        },
      ]);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      const insertId = await embedder.insertRuleset(ruleset, { skip: "same-id-and-version-gte" });
      expect(insertId).to.eq(rulesetElementId);
    });

    it("updates a duplicate ruleset with same id and version", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "0x111";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", [
        {
          ruleset,
          elementId: rulesetElementId,
        },
      ]);

      const rulesetElementMock = { id: rulesetElementId, update: sandbox.stub(), jsonProperties: {} };
      imodelMock.elements.tryGetElement.withArgs(rulesetElementId).returns(rulesetElementMock);

      const insertId = await embedder.insertRuleset(ruleset, { skip: "never", replaceVersions: "exact", onEntityUpdate });
      expect(insertId).to.eq(rulesetElementId);
      expect(rulesetElementMock.update).to.be.calledOnce;
      expect(onEntityUpdate.onBeforeUpdate).to.have.been.calledOnce;
      expect(onEntityUpdate.onAfterUpdate).to.have.been.calledOnce;
    });

    it("removes rulesets with same id", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "0x111";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", [
        {
          ruleset: { ...ruleset, version: "4.5.6" },
          elementId: "0x222",
        },
        {
          ruleset: { ...ruleset, version: "7.8.9" },
          elementId: "0x333",
        },
      ]);

      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      const insertId = await embedder.insertRuleset(ruleset, { replaceVersions: "all" });
      expect(insertId).to.eq(rulesetElementId);
      expect(imodelMock.elements.deleteElement).to.be.calledOnce;
      expect(imodelMock.elements.deleteElement).to.be.calledWithExactly(["0x222", "0x333"]);
    });

    it("removes older rulesets with same id", async () => {
      const ruleset: Ruleset = { id: "test", version: "4.5.6", rules: [] };
      const rulesetElementId = "0x222";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", [
        {
          ruleset: { ...ruleset, version: "1.2.3" },
          elementId: "0x111",
        },
        {
          ruleset: { ...ruleset, version: "7.8.9" },
          elementId: "0x333",
        },
      ]);

      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      const insertId = await embedder.insertRuleset(ruleset, { replaceVersions: "all-lower" });
      expect(insertId).to.eq(rulesetElementId);
      expect(imodelMock.elements.deleteElement).to.be.calledOnce;
      expect(imodelMock.elements.deleteElement).to.be.calledWithExactly(["0x111"]);
    });
  });

  describe("getRulesets", () => {
    function setupMocksForQueryingAllRulesets(rulesets: Array<{ ruleset: Ruleset; elementId: Id64String }>) {
      rulesets.forEach((entry) => {
        const rulesetElementMock = { jsonProperties: { jsonProperties: entry.ruleset } };
        imodelMock.elements.getElement.withArgs({ id: entry.elementId }).returns(rulesetElementMock);
      });
      imodelMock.createQueryReader.withArgs(sinon.match.string).returns(stubECSqlReader(rulesets.map((r) => ({ id: r.elementId }))));
    }

    it("checks for prerequisites before getting rulesets", async () => {
      imodelMock.containsClass.withArgs(RulesetElements.Ruleset.classFullName).returns(false);
      const rulesets = await embedder.getRulesets();
      expect(rulesets.length).to.eq(0);
    });

    it("returns embedded rulesets", async () => {
      const ruleset1: Ruleset = { id: "test1", rules: [] };
      const ruleset2: Ruleset = { id: "test2", rules: [] };

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingAllRulesets([
        {
          ruleset: ruleset1,
          elementId: "0x123",
        },
        {
          ruleset: ruleset2,
          elementId: "0x456",
        },
      ]);
      const rulesets = await embedder.getRulesets();
      expect(rulesets).to.deep.eq([ruleset1, ruleset2]);
    });
  });
});
