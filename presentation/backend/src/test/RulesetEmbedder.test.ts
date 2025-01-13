/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import faker from "faker";
import sinon from "sinon";
import * as moq from "typemoq";
import {
  BisCoreSchema,
  CodeSpecs,
  DefinitionElement,
  DefinitionModel,
  DefinitionPartition,
  ECSqlStatement,
  IModelDb,
  KnownLocations,
  Model,
  Subject,
} from "@itwin/core-backend";
import { DbResult, Id64String } from "@itwin/core-bentley";
import {
  BisCodeSpec,
  Code,
  CodeScopeSpec,
  CodeSpec,
  DefinitionElementProps,
  ECSqlReader,
  IModel,
  QueryBinder,
  QueryRowFormat,
  QueryRowProxy,
} from "@itwin/core-common";
import { Ruleset } from "@itwin/presentation-common";
import { configureForPromiseResult } from "@itwin/presentation-common/lib/cjs/test";
import { PresentationRules } from "../presentation-backend/domain/PresentationRulesDomain";
import * as RulesetElements from "../presentation-backend/domain/RulesetElements";
import { RulesetEmbedder } from "../presentation-backend/RulesetEmbedder";
import { normalizeVersion } from "../presentation-backend/Utils";

describe("RulesetEmbedder", () => {
  let embedder: RulesetEmbedder;

  let imodelMock: moq.IMock<IModelDb>;
  let codeSpecsMock: moq.IMock<CodeSpecs>;
  let elementsMock: moq.IMock<IModelDb.Elements>;
  let modelsMock: moq.IMock<IModelDb.Models>;
  let rootSubjectMock: moq.IMock<Subject>;
  let presentationRulesSubjectMock: moq.IMock<Subject>;
  let definitionPartitionMock: moq.IMock<DefinitionPartition>;
  let definitionElementMock: moq.IMock<DefinitionElement>;
  let rulesetModelMock: moq.IMock<Model>;

  let rootSubjectId: string;
  let presentationRulesSubjectId: string;
  let definitionPartitionId: string;
  let modelId: string;

  let rulesetCodeSpec: CodeSpec;
  let subjectCodeSpec: CodeSpec;
  let informationPartitionCodeSpec: CodeSpec;

  const onEntityUpdate = {
    onBeforeUpdate: sinon.spy(),
    onAfterUpdate: sinon.spy(),
  };

  const onEntityInsert = {
    onBeforeInsert: sinon.spy(),
    onAfterInsert: sinon.spy(),
  };

  beforeEach(async () => {
    sinon.stub(KnownLocations, "nativeAssetsDir").get(() => "");
    BisCoreSchema.registerSchema();
    initializeMocks();
    embedder = new RulesetEmbedder({ imodel: imodelMock.object });
  });

  afterEach(async () => {
    sinon.restore();
    onEntityInsert.onBeforeInsert.resetHistory();
    onEntityInsert.onAfterInsert.resetHistory();
    onEntityUpdate.onBeforeUpdate.resetHistory();
    onEntityUpdate.onAfterUpdate.resetHistory();
  });

  function initializeMocks() {
    // ids
    rootSubjectId = faker.random.uuid();
    presentationRulesSubjectId = faker.random.uuid();
    definitionPartitionId = faker.random.uuid();
    modelId = faker.random.uuid();

    // create mocks
    imodelMock = moq.Mock.ofType<IModelDb>();
    codeSpecsMock = moq.Mock.ofType<CodeSpecs>();
    elementsMock = moq.Mock.ofType<IModelDb.Elements>();
    modelsMock = moq.Mock.ofType<IModelDb.Models>();
    rootSubjectMock = moq.Mock.ofType<Subject>();
    presentationRulesSubjectMock = moq.Mock.ofType<Subject>();
    definitionPartitionMock = moq.Mock.ofType<DefinitionPartition>();
    definitionElementMock = moq.Mock.ofType<DefinitionElement>();
    rulesetModelMock = moq.Mock.ofType<Model>(undefined, undefined, false);

    // create code specs
    rulesetCodeSpec = CodeSpec.create(imodelMock.object, PresentationRules.CodeSpec.Ruleset, CodeScopeSpec.Type.Model);

    subjectCodeSpec = CodeSpec.create(imodelMock.object, BisCodeSpec.subject, CodeScopeSpec.Type.ParentElement);
    subjectCodeSpec.id = faker.random.uuid();

    informationPartitionCodeSpec = CodeSpec.create(imodelMock.object, BisCodeSpec.informationPartitionElement, CodeScopeSpec.Type.ParentElement);
    informationPartitionCodeSpec.id = faker.random.uuid();

    // set up mocks
    imodelMock.setup((x) => x.codeSpecs).returns(() => codeSpecsMock.object);
    imodelMock.setup((x) => x.elements).returns(() => elementsMock.object);
    imodelMock.setup((x) => x.models).returns(() => modelsMock.object);

    codeSpecsMock.setup((x) => x.getByName(PresentationRules.CodeSpec.Ruleset)).returns(() => rulesetCodeSpec);
    codeSpecsMock.setup((x) => x.getByName(BisCodeSpec.subject)).returns(() => subjectCodeSpec);
    codeSpecsMock.setup((x) => x.getByName(BisCodeSpec.informationPartitionElement)).returns(() => informationPartitionCodeSpec);

    elementsMock.setup((x) => x.getElement(IModel.rootSubjectId)).returns(() => rootSubjectMock.object);

    rootSubjectMock.setup((x) => x.id).returns(() => rootSubjectId);
    rootSubjectMock.setup((x) => x.model).returns(() => modelId);
    configureForPromiseResult(rootSubjectMock);

    presentationRulesSubjectMock.setup((x) => x.id).returns(() => presentationRulesSubjectId);
    presentationRulesSubjectMock.setup((x) => x.insert()).returns(() => presentationRulesSubjectId);
    presentationRulesSubjectMock.setup((x) => x.model).returns(() => modelId);
    configureForPromiseResult(presentationRulesSubjectMock);

    definitionPartitionMock.setup((x) => x.id).returns(() => definitionPartitionId);
    definitionPartitionMock.setup((x) => x.insert()).returns(() => definitionPartitionId);
    definitionPartitionMock.setup((x) => x.model).returns(() => modelId);
    configureForPromiseResult(definitionPartitionMock);

    configureForPromiseResult(definitionElementMock);

    rulesetModelMock.setup((x) => x.id).returns(() => modelId);
    configureForPromiseResult(rulesetModelMock);
  }

  function setupMocksForHandlingPrerequisites() {
    imodelMock.setup((x) => x.containsClass(RulesetElements.Ruleset.classFullName)).returns(() => false);
    imodelMock.setup(async (x) => x.importSchemas(moq.It.isAny())).returns(async () => undefined);
    codeSpecsMock.setup((x) => x.insert(rulesetCodeSpec)).returns(() => faker.random.uuid());
  }

  function setupMocksForGettingRulesetModel() {
    imodelMock.setup((x) => x.containsClass(RulesetElements.Ruleset.classFullName)).returns(() => true);
    modelsMock.setup((x) => x.getSubModel(definitionPartitionId)).returns(() => rulesetModelMock.object);
    elementsMock
      .setup((x) => x.tryGetElement(new Code({ spec: subjectCodeSpec.id, scope: rootSubjectMock.object.id, value: "PresentationRules" })))
      .returns(() => presentationRulesSubjectMock.object);
    elementsMock
      .setup((x) => x.tryGetElement(DefinitionPartition.createCode(imodelMock.object, presentationRulesSubjectMock.object.id, "PresentationRules")))
      .returns(() => definitionPartitionMock.object);
  }

  function setupMocksForCreatingRulesetModel() {
    imodelMock.setup((x) => x.containsClass(RulesetElements.Ruleset.classFullName)).returns(() => true);
    elementsMock
      .setup((x) => x.tryGetElement(new Code({ spec: subjectCodeSpec.id, scope: rootSubjectMock.object.id, value: "PresentationRules" })))
      .returns(() => undefined);
    elementsMock.setup((x) => x.getElement(presentationRulesSubjectId)).returns(() => presentationRulesSubjectMock.object);
    elementsMock.setup((x) => x.getElement(definitionPartitionId)).returns(() => definitionPartitionMock.object);

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
    elementsMock.setup((x) => x.createElement(createSubjectProps)).returns(() => presentationRulesSubjectMock.object);

    const createPartitionProps = {
      parent: {
        id: presentationRulesSubjectId,
        relClassName: "BisCore:SubjectOwnsPartitionElements",
      },
      model: modelId,
      code: DefinitionPartition.createCode(imodelMock.object, presentationRulesSubjectId, "PresentationRules"),
      classFullName: DefinitionPartition.classFullName,
    };
    elementsMock.setup((x) => x.createElement(createPartitionProps)).returns(() => definitionPartitionMock.object);

    const createModelProps = {
      modeledElement: definitionPartitionMock.object,
      name: "PresentationRules",
      classFullName: DefinitionModel.classFullName,
      isPrivate: true,
    };
    modelsMock.setup((x) => x.createModel(createModelProps)).returns(() => rulesetModelMock.object);
  }

  function setupMocksForQueryingExistingRulesets(rulesetId: string, rulesets: Array<{ ruleset: Ruleset; elementId: Id64String }>) {
    const results = rulesets.map((entry) => ({
      id: entry.elementId,
      jsonProperties: JSON.stringify({ jsonProperties: entry.ruleset }),
      normalizedVersion: normalizeVersion(entry.ruleset.version),
    }));
    let currIndex = -1;
    const ecSqlReaderMock = moq.Mock.ofType<ECSqlReader>();
    ecSqlReaderMock.setup(async (x) => x.step()).returns(async () => ++currIndex < results.length);
    ecSqlReaderMock
      .setup((x) => x.current)
      .returns(() => {
        const queryRowProxyMock = moq.Mock.ofType<QueryRowProxy>();
        queryRowProxyMock.setup((x) => x.toRow()).returns(() => results[currIndex]);
        return queryRowProxyMock.object;
      });
    imodelMock
      .setup((x) => x.createQueryReader(moq.It.isAnyString(), QueryBinder.from({ rulesetId }), { rowFormat: QueryRowFormat.UseJsPropertyNames }))
      .returns(() => ecSqlReaderMock.object);
  }

  function createRulesetElementProps(ruleset: Ruleset): DefinitionElementProps {
    return {
      model: modelId,
      code: RulesetElements.Ruleset.createRulesetCode(imodelMock.object, modelId, ruleset),
      classFullName: RulesetElements.Ruleset.classFullName,
      jsonProperties: { jsonProperties: ruleset },
    };
  }

  function setupMocksForInsertingNewRuleset(ruleset: Ruleset, rulesetElementId: string) {
    definitionElementMock.setup((x) => x.id).returns(() => rulesetElementId);
    definitionElementMock.setup((x) => x.insert()).returns(() => rulesetElementId);
    elementsMock.setup((x) => x.createElement(createRulesetElementProps(ruleset))).returns(() => definitionElementMock.object);
    elementsMock.setup((x) => x.getElement(rulesetElementId)).returns(() => definitionElementMock.object);
  }

  describe("insertRuleset", () => {
    it("sets up prerequisites when inserting element", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "0x123";

      setupMocksForHandlingPrerequisites();
      setupMocksForCreatingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", []);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      await embedder.insertRuleset(ruleset);

      imodelMock.verify(async (x) => x.importSchemas(moq.It.isAny()), moq.Times.once());
      codeSpecsMock.verify((x) => x.insert(rulesetCodeSpec), moq.Times.once());
      rulesetModelMock.verify((x) => x.insert(), moq.Times.once());
      imodelMock.verify((x) => x.saveChanges(), moq.Times.exactly(2));
    });

    it("calls `onElementInsert` and `onModelInsert` callbacks when creating RulesetModel", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "0x123";

      setupMocksForCreatingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", []);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      await embedder.insertRuleset(ruleset, { onEntityInsert });

      expect(onEntityInsert.onBeforeInsert.callCount).to.eq(4);
      expect(onEntityInsert.onAfterInsert.callCount).to.eq(4);
    });

    it("inserts a single ruleset", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "0x123";

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
      const parentSubjectId = "0x123";
      const rulesetElementId = "0x456";

      elementsMock.setup((x) => x.getElement(parentSubjectId)).returns(() => rootSubjectMock.object);
      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", []);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      embedder = new RulesetEmbedder({ imodel: imodelMock.object, parentSubjectId });
      const insertId = await embedder.insertRuleset(ruleset, { onEntityInsert });
      expect(insertId).to.eq(rulesetElementId);
      expect(onEntityInsert.onBeforeInsert).to.be.calledOnce;
      expect(onEntityInsert.onAfterInsert).to.be.calledOnce;
    });

    it("creates missing subject, partition and model under specified parent subject id", async () => {
      const ruleset: Ruleset = { id: "test", version: "4.5.6", rules: [] };
      const parentSubjectId = "0x123";
      const rulesetElementId = "0x456";

      elementsMock.setup((x) => x.getElement(parentSubjectId)).returns(() => rootSubjectMock.object);
      setupMocksForCreatingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", []);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      embedder = new RulesetEmbedder({ imodel: imodelMock.object, parentSubjectId });
      const insertId = await embedder.insertRuleset(ruleset, { onEntityInsert });
      expect(insertId).to.eq(rulesetElementId);
      expect(onEntityInsert.onBeforeInsert).to.have.callCount(4);
      expect(onEntityInsert.onAfterInsert).to.have.callCount(4);
    });

    it("throws error if specified parent subject id is not found", async () => {
      const ruleset: Ruleset = { id: "test", version: "4.5.6", rules: [] };
      const parentSubjectId = "0x123";
      const rulesetElementId = "0x456";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", []);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      embedder = new RulesetEmbedder({ imodel: imodelMock.object, parentSubjectId });
      await expect(embedder.insertRuleset(ruleset, { onEntityInsert })).to.be.rejected;
      expect(onEntityInsert.onBeforeInsert).not.to.be.called;
      expect(onEntityInsert.onAfterInsert).not.to.be.called;
    });

    it("skips inserting ruleset with same id", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "0x123";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", [
        {
          ruleset,
          elementId: rulesetElementId,
        },
      ]);

      const insertId = await embedder.insertRuleset(ruleset, { skip: "same-id" });
      expect(insertId).to.eq(rulesetElementId);
      elementsMock.verify((x) => x.insertElement(createRulesetElementProps(ruleset)), moq.Times.never());
    });

    it("doesn't skip inserting ruleset with different id", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "123";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", []);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      const insertId = await embedder.insertRuleset(ruleset, { skip: "same-id" });
      expect(insertId).to.eq(rulesetElementId);
    });

    it("skips inserting ruleset with same id and version", async () => {
      const ruleset: Ruleset = { id: "test", version: "1.2.3", rules: [] };
      const rulesetElementId = "0x123";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", [
        {
          ruleset,
          elementId: rulesetElementId,
        },
      ]);

      const insertId = await embedder.insertRuleset(ruleset, { skip: "same-id-and-version-eq" });
      expect(insertId).to.eq(rulesetElementId);
      elementsMock.verify((x) => x.insertElement(createRulesetElementProps(ruleset)), moq.Times.never());
    });

    it("doesn't skip inserting ruleset with same id and different version", async () => {
      const ruleset: Ruleset = { id: "test", version: "1.2.3", rules: [] };
      const rulesetElementId = "0x123";

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
          elementId: "0x123",
        },
        {
          ruleset: { id: "test", version: "4.5.6", rules: [] },
          elementId: "0x456",
        },
        {
          ruleset: { id: "test", version: "7.8.9", rules: [] },
          elementId: "0x789",
        },
      ]);

      const insertId = await embedder.insertRuleset(ruleset, { skip: "same-id-and-version-gte" });
      expect(insertId).to.eq("0x789");
      elementsMock.verify((x) => x.insertElement(createRulesetElementProps(ruleset)), moq.Times.never());
    });

    it("doesn't skip inserting ruleset with same id and higher version", async () => {
      const ruleset: Ruleset = { id: "test", version: "4.5.6", rules: [] };
      const rulesetElementId = "0x456";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", [
        {
          ruleset: { id: "test", version: "1.2.3", rules: [] },
          elementId: "0x123",
        },
      ]);
      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      const insertId = await embedder.insertRuleset(ruleset, { skip: "same-id-and-version-gte" });
      expect(insertId).to.eq(rulesetElementId);
    });

    it("updates a duplicate ruleset with same id and version", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "0x123";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", [
        {
          ruleset,
          elementId: rulesetElementId,
        },
      ]);

      const rulesetElementMock = moq.Mock.ofType<RulesetElements.Ruleset>();
      rulesetElementMock.setup((x) => x.id).returns(() => rulesetElementId);
      elementsMock.setup((x) => x.tryGetElement(rulesetElementId)).returns(() => rulesetElementMock.object);

      const insertId = await embedder.insertRuleset(ruleset, { skip: "never", replaceVersions: "exact", onEntityUpdate });
      expect(insertId).to.eq(rulesetElementId);
      rulesetElementMock.verify((x) => x.update(), moq.Times.once());
      expect(onEntityUpdate.onBeforeUpdate).to.have.been.calledOnce;
      expect(onEntityUpdate.onAfterUpdate).to.have.been.calledOnce;
    });

    it("removes rulesets with same id", async () => {
      const ruleset: Ruleset = { id: "test", rules: [] };
      const rulesetElementId = "0x123";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", [
        {
          ruleset: { ...ruleset, version: "4.5.6" },
          elementId: "0x456",
        },
        {
          ruleset: { ...ruleset, version: "7.8.9" },
          elementId: "0x789",
        },
      ]);

      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      const insertId = await embedder.insertRuleset(ruleset, { replaceVersions: "all" });
      expect(insertId).to.eq(rulesetElementId);
      elementsMock.verify((x) => x.deleteElement(["0x456", "0x789"]), moq.Times.once());
    });

    it("removes older rulesets with same id", async () => {
      const ruleset: Ruleset = { id: "test", version: "4.5.6", rules: [] };
      const rulesetElementId = "0x456";

      setupMocksForGettingRulesetModel();
      setupMocksForQueryingExistingRulesets("test", [
        {
          ruleset: { ...ruleset, version: "1.2.3" },
          elementId: "0x123",
        },
        {
          ruleset: { ...ruleset, version: "7.8.9" },
          elementId: "0x789",
        },
      ]);

      setupMocksForInsertingNewRuleset(ruleset, rulesetElementId);

      const insertId = await embedder.insertRuleset(ruleset, { replaceVersions: "all-lower" });
      expect(insertId).to.eq(rulesetElementId);
      elementsMock.verify((x) => x.deleteElement(["0x123"]), moq.Times.once());
    });
  });

  describe("getRulesets", () => {
    function setupMocksForQueryingAllRulesets(rulesets: Array<{ ruleset: Ruleset; elementId: Id64String }>) {
      imodelMock
        .setup((x) => x.withPreparedStatement(moq.It.isAny(), moq.It.isAny()))
        .callback((_ecsql, callbackFun) => {
          const statementMock = moq.Mock.ofType<ECSqlStatement>();
          rulesets.forEach((entry) => {
            statementMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_ROW);
            statementMock.setup((x) => x.getRow()).returns(() => ({ id: entry.elementId }));

            const rulesetElementMock = moq.Mock.ofType<RulesetElements.Ruleset>();
            rulesetElementMock.setup((x) => x.jsonProperties).returns(() => ({ jsonProperties: entry.ruleset }));
            elementsMock.setup((x) => x.getElement({ id: entry.elementId })).returns(() => rulesetElementMock.object);
          });
          statementMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_DONE);
          callbackFun(statementMock.object);
        })
        .returns(() => ({}));
    }

    it("checks for prerequisites before getting rulesets", async () => {
      imodelMock.setup((x) => x.containsClass(RulesetElements.Ruleset.classFullName)).returns(() => false);
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
