/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import faker from "faker";
import sinon from "sinon";
import { DbResult, Id64 } from "@bentley/bentleyjs-core";
import { BisCoreSchema, CodeSpecs, DefinitionModel, DefinitionPartition, ECSqlStatement, IModelDb, KnownLocations, Model, Subject } from "@bentley/imodeljs-backend";
import { BisCodeSpec, Code, CodeScopeSpec, CodeSpec, DefinitionElementProps } from "@bentley/imodeljs-common";
import { Ruleset } from "@bentley/presentation-common";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { createRandomRuleset } from "@bentley/presentation-common/lib/test/_helpers/random";
import { PresentationRules } from "../presentation-backend/domain/PresentationRulesDomain";
import * as RulesetElements from "../presentation-backend/domain/RulesetElements";
import { DuplicateRulesetHandlingStrategy, RulesetEmbedder } from "../presentation-backend/RulesetEmbedder";

describe("RulesetEmbedder", () => {
  let embedder: RulesetEmbedder;
  let ruleset: Ruleset;
  let rulesetProperties: DefinitionElementProps;

  let imodelMock: moq.IMock<IModelDb>;
  let codeSpecsMock: moq.IMock<CodeSpecs>;
  let elementsMock: moq.IMock<IModelDb.Elements>;
  let modelsMock: moq.IMock<IModelDb.Models>;
  let rootSubjectMock: moq.IMock<Subject>;
  let subjectMock: moq.IMock<Subject>;
  let definitionPartitionMock: moq.IMock<DefinitionPartition>;
  let rulesetModelMock: moq.IMock<Model>;
  let statementMock: moq.IMock<ECSqlStatement>;
  let rulesetElementMock: moq.IMock<RulesetElements.Ruleset>;

  let rootId: string;
  let subjectId: string;
  let definitionPartitionId: string;
  let modelId: string;
  let rulesetId: string;
  let rulesetCodeSpecId: string;

  let rulesetCodeSpec: CodeSpec;
  let subjectCodeSpec: CodeSpec;
  let informationPartitionCodeSpec: CodeSpec;

  beforeEach(async () => {
    sinon.stub(KnownLocations, "nativeAssetsDir").get(() => "");

    BisCoreSchema.registerSchema();

    initializeMocks();
    generateRandomIds();
    initializeCodeSpecs();
    setupRootSubjectMock();
    setupSubjectMock();
    setupDefinitionPartitionMock();
    rulesetModelMock.setup((x) => x.id).returns(() => modelId);
    setupCodeSpecsMock();

    embedder = new RulesetEmbedder({ imodel: imodelMock.object });
    ruleset = await createRandomRuleset();

    rulesetProperties = {
      model: modelId,
      code: RulesetElements.Ruleset.createRulesetCode(modelId, ruleset.id, imodelMock.object),
      classFullName: RulesetElements.Ruleset.classFullName,
      jsonProperties: { jsonProperties: ruleset },
    };

    setupElementsMock();
    imodelMock.setup((x) => x.models).returns(() => modelsMock.object);
  });

  afterEach(async () => {
    sinon.restore();
  });

  function initializeMocks() {
    imodelMock = moq.Mock.ofType<IModelDb>();
    codeSpecsMock = moq.Mock.ofType<CodeSpecs>();
    elementsMock = moq.Mock.ofType<IModelDb.Elements>();
    modelsMock = moq.Mock.ofType<IModelDb.Models>();
    rootSubjectMock = moq.Mock.ofType<Subject>();
    subjectMock = moq.Mock.ofType<Subject>();
    definitionPartitionMock = moq.Mock.ofType<DefinitionPartition>();
    rulesetModelMock = moq.Mock.ofType<Model>();
    statementMock = moq.Mock.ofType<ECSqlStatement>();
    rulesetElementMock = moq.Mock.ofType<RulesetElements.Ruleset>();
  }

  function generateRandomIds() {
    rootId = faker.random.uuid();
    subjectId = faker.random.uuid();
    definitionPartitionId = faker.random.uuid();
    modelId = faker.random.uuid();
    rulesetId = faker.random.uuid();
    rulesetCodeSpecId = faker.random.uuid();
  }

  function initializeCodeSpecs() {
    rulesetCodeSpec = CodeSpec.create(imodelMock.object, PresentationRules.CodeSpec.Ruleset, CodeScopeSpec.Type.Model);
    rulesetCodeSpec.id = rulesetCodeSpecId;
    subjectCodeSpec = CodeSpec.create(imodelMock.object, BisCodeSpec.subject, CodeScopeSpec.Type.ParentElement);
    subjectCodeSpec.id = faker.random.uuid();
    informationPartitionCodeSpec = CodeSpec.create(imodelMock.object, BisCodeSpec.informationPartitionElement, CodeScopeSpec.Type.ParentElement);
    informationPartitionCodeSpec.id = faker.random.uuid();
  }

  function setupRootSubjectMock() {
    rootSubjectMock.setup((x) => x.id).returns(() => rootId);
    rootSubjectMock.setup((x) => x.model).returns(() => modelId);
  }

  function setupSubjectMock() {
    subjectMock.setup((x) => x.id).returns(() => subjectId);
    subjectMock.setup((x) => x.model).returns(() => modelId);
  }

  function setupDefinitionPartitionMock() {
    definitionPartitionMock.setup((x) => x.id).returns(() => definitionPartitionId);
    definitionPartitionMock.setup((x) => x.model).returns(() => modelId);
  }

  function setupCodeSpecsMock() {
    codeSpecsMock.setup((x) => x.getByName(PresentationRules.CodeSpec.Ruleset)).returns(() => rulesetCodeSpec);
    codeSpecsMock.setup((x) => x.getByName(BisCodeSpec.subject)).returns(() => subjectCodeSpec);
    codeSpecsMock.setup((x) => x.getByName(BisCodeSpec.informationPartitionElement)).returns(() => informationPartitionCodeSpec);
    imodelMock.setup((x) => x.codeSpecs).returns(() => codeSpecsMock.object);
  }

  function setupElementsMock() {
    elementsMock.setup((x) => x.getRootSubject()).returns(() => rootSubjectMock.object);
    imodelMock.setup((x) => x.elements).returns(() => elementsMock.object);
  }

  function setupMocksForGettingRulesetModel() {
    modelsMock.setup((x) => x.getSubModel(definitionPartitionId)).returns(() => rulesetModelMock.object);
    elementsMock.setup((x) => x.tryGetElement(new Code({ spec: subjectCodeSpec.id, scope: rootSubjectMock.object.id, value: "PresentationRules" }))).returns(() => subjectMock.object);
    elementsMock.setup((x) => x.tryGetElement(DefinitionPartition.createCode(imodelMock.object, subjectMock.object.id, "PresentationRules"))).returns(() => definitionPartitionMock.object);
  }

  function setupMocksForQueryingRulesets() {
    elementsMock.setup((x) => x.getElement({ id: rulesetId })).returns(() => rulesetElementMock.object);
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.isAny(), moq.It.isAny())).callback((_ecsql, callbackFun) => {
      callbackFun(statementMock.object);
    }).returns(() => ({}));

    const rulesetAsProp = { jsonProperties: ruleset };
    statementMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_ROW);
    statementMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_DONE);
    statementMock.setup((x) => x.getRow()).returns(() => ({ id: rulesetId }));
    rulesetElementMock.setup((x) => x.jsonProperties).returns(() => rulesetAsProp);
  }

  function setupMocksForQueryingRulesetsWithNoResults() {
    imodelMock.setup((x) => x.withPreparedStatement(moq.It.isAny(), moq.It.isAny())).callback((_ecsql, callbackFun) => {
      callbackFun(statementMock.object);
    }).returns(() => ({}));

    statementMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_DONE);
  }

  function setupMocksForHandlingPrerequisites() {
    const subjectProps = {
      classFullName: Subject.classFullName,
      model: modelId,
      code: new Code({
        spec: subjectCodeSpec.id,
        scope: rootId,
        value: "PresentationRules",
      }),
      parent: {
        id: rootId,
        relClassName: "BisCore:SubjectOwnsSubjects",
      },
    };

    const modelProps = {
      modeledElement: definitionPartitionMock.object,
      name: "PresentationRules",
      classFullName: DefinitionModel.classFullName,
    };

    rulesetCodeSpec.id = Id64.invalid;
    codeSpecsMock.setup((x) => x.insert(rulesetCodeSpec)).returns(() => rulesetCodeSpecId);

    const definitionPartitionProps = {
      parent: {
        id: subjectId,
        relClassName: "BisCore:SubjectOwnsPartitionElements",
      },
      model: modelId,
      code: DefinitionPartition.createCode(imodelMock.object, subjectId, "PresentationRules"),
      classFullName: DefinitionPartition.classFullName,
    };

    elementsMock.setup((x) => x.tryGetElement(new Code({ spec: subjectCodeSpec.id, scope: rootSubjectMock.object.id, value: "PresentationRules" }))).returns(() => undefined);
    elementsMock.setup((x) => x.getElement(subjectId)).returns(() => subjectMock.object);
    elementsMock.setup((x) => x.getElement(definitionPartitionId)).returns(() => definitionPartitionMock.object);
    elementsMock.setup((x) => x.insertElement(subjectProps)).returns(() => subjectId);
    elementsMock.setup((x) => x.insertElement(definitionPartitionProps)).returns(() => definitionPartitionId);

    modelsMock.setup((x) => x.createModel(modelProps)).returns(() => rulesetModelMock.object);

    imodelMock.setup((x) => x.containsClass(RulesetElements.Ruleset.classFullName)).returns(() => false);
  }

  describe("insertRuleset", () => {
    it("inserts a single ruleset", async () => {
      // Setup
      setupMocksForGettingRulesetModel();

      elementsMock.setup((x) => x.insertElement(rulesetProperties)).returns(() => rulesetId);
      imodelMock.setup((x) => x.containsClass(RulesetElements.Ruleset.classFullName)).returns(() => true);

      // Act
      const insertId = await embedder.insertRuleset(ruleset);

      // Assert
      expect(rulesetId).to.be.equal(insertId);
    });

    it("does not insert same ruleset twice", async () => {
      // Setup
      setupMocksForGettingRulesetModel();

      elementsMock.setup((x) => x.insertElement(rulesetProperties)).returns(() => rulesetId);
      elementsMock.setup((x) => x.queryElementIdByCode(RulesetElements.Ruleset.createRulesetCode(modelId, ruleset.id, imodelMock.object))).returns(() => rulesetId);
      imodelMock.setup((x) => x.containsClass(RulesetElements.Ruleset.classFullName)).returns(() => true);

      // Act
      const insertId = await embedder.insertRuleset(ruleset);
      const repeatedInsertId = await embedder.insertRuleset(ruleset);

      // Assert
      expect(insertId).to.be.equal(repeatedInsertId);
    });

    it("inserts multiple rulesets", async () => {
      // Setup
      setupMocksForGettingRulesetModel();

      const ruleset2 = await createRandomRuleset();
      const rulesetProperties2 = {
        model: modelId,
        code: RulesetElements.Ruleset.createRulesetCode(modelId, ruleset2.id, imodelMock.object),
        classFullName: RulesetElements.Ruleset.classFullName,
        jsonProperties: { jsonProperties: ruleset2 },
      };
      const rulesetId2 = faker.random.uuid();

      elementsMock.setup((x) => x.insertElement(rulesetProperties)).returns(() => rulesetId);
      elementsMock.setup((x) => x.insertElement(rulesetProperties2)).returns(() => rulesetId2);
      imodelMock.setup((x) => x.containsClass(RulesetElements.Ruleset.classFullName)).returns(() => true);

      // Act
      await embedder.insertRuleset(ruleset);
      const actualInsertId2 = await embedder.insertRuleset(ruleset2);

      // Assert
      expect(rulesetId2).to.be.equal(actualInsertId2);
    });

    it("inserts element when prerequisites are not set up", async () => {
      // Setup
      setupMocksForHandlingPrerequisites();
      elementsMock.setup((x) => x.insertElement(rulesetProperties)).returns(() => rulesetId);

      // Act
      const insertId = await embedder.insertRuleset(ruleset);

      // Assert element has been inserted
      expect(rulesetId).to.be.equal(insertId);

      // Assert pre
      imodelMock.verify(async (x) => x.importSchemas(moq.It.isAny(), moq.It.isAny()), moq.Times.once());
      codeSpecsMock.verify((x) => x.insert(rulesetCodeSpec), moq.Times.once());
      modelsMock.verify((x) => x.insertModel(moq.It.isAny()), moq.Times.once());
      imodelMock.verify((x) => x.saveChanges(), moq.Times.once());
    });

    it("skips inserting a duplicate ruleset", async () => {
      const ruleset2 = await createRandomRuleset();
      ruleset2.id = ruleset.id;

      // Setup
      setupMocksForGettingRulesetModel();

      elementsMock.setup((x) => x.insertElement(rulesetProperties)).returns(() => rulesetId);
      elementsMock.setup((x) => x.queryElementIdByCode(RulesetElements.Ruleset.createRulesetCode(modelId, ruleset2.id, imodelMock.object))).returns(() => rulesetId);
      imodelMock.setup((x) => x.containsClass(RulesetElements.Ruleset.classFullName)).returns(() => true);

      // Act
      const insertId = await embedder.insertRuleset(ruleset);
      const repeatedInsertId = await embedder.insertRuleset(ruleset2, DuplicateRulesetHandlingStrategy.Skip);

      // Assert
      expect(insertId).to.be.equal(repeatedInsertId);
    });

    it("fails updating a duplicate ruleset when ruleset can't be located", async () => {
      const ruleset2 = await createRandomRuleset();
      ruleset2.id = ruleset.id;

      // Setup
      setupMocksForGettingRulesetModel();

      elementsMock.setup((x) => x.insertElement(rulesetProperties)).returns(() => rulesetId);
      elementsMock.setup((x) => x.queryElementIdByCode(RulesetElements.Ruleset.createRulesetCode(modelId, ruleset2.id, imodelMock.object))).returns(() => rulesetId);
      elementsMock.setup((x) => x.tryGetElement(rulesetId)).returns(() => undefined);
      imodelMock.setup((x) => x.containsClass(RulesetElements.Ruleset.classFullName)).returns(() => true);

      // Act
      await embedder.insertRuleset(ruleset);
      const repeatedInsertId = await embedder.insertRuleset(ruleset2, DuplicateRulesetHandlingStrategy.Replace);

      // Assert
      expect(Id64.isValid(repeatedInsertId)).false;
    });

    it("updates a duplicate ruleset", async () => {
      const ruleset2 = await createRandomRuleset();
      ruleset2.id = ruleset.id;

      // Setup
      setupMocksForGettingRulesetModel();

      elementsMock.setup((x) => x.insertElement(rulesetProperties)).returns(() => rulesetId);
      elementsMock.setup((x) => x.queryElementIdByCode(RulesetElements.Ruleset.createRulesetCode(modelId, ruleset2.id, imodelMock.object))).returns(() => rulesetId);
      elementsMock.setup((x) => x.tryGetElement(rulesetId)).returns(() => rulesetElementMock.object);
      imodelMock.setup((x) => x.containsClass(RulesetElements.Ruleset.classFullName)).returns(() => true);

      // Act
      const insertId = await embedder.insertRuleset(ruleset);
      const repeatedInsertId = await embedder.insertRuleset(ruleset2, DuplicateRulesetHandlingStrategy.Replace);

      // Assert
      expect(insertId).to.be.equal(repeatedInsertId);
      rulesetElementMock.verify((x) => x.update(), moq.Times.once());
    });
  });

  describe("getRulesets", () => {
    it("loads rulesets equal to the inserted", async () => {
      // Setup
      setupMocksForGettingRulesetModel();
      setupMocksForQueryingRulesets();

      elementsMock.setup((x) => x.insertElement(rulesetProperties)).returns(() => rulesetId);
      imodelMock.setup((x) => x.containsClass(RulesetElements.Ruleset.classFullName)).returns(() => true);

      // Act
      await embedder.insertRuleset(ruleset);
      const rulesets = await embedder.getRulesets();

      // Assert rulesets are equal the same as inserted
      expect(rulesets).to.be.deep.equal([ruleset]);
    });

    it("checks for prerequisites before getting rulesets", async () => {
      // Setup
      setupMocksForHandlingPrerequisites();

      // Act
      const rulesets = await embedder.getRulesets();

      // Assert that a check has been made
      imodelMock.verify((x) => x.containsClass(RulesetElements.Ruleset.classFullName), moq.Times.once());

      // Assert that rulesets array is empty
      expect(0).to.be.equal(rulesets.length);
    });

    it("returns empty array if no rulesets have been inserted", async () => {
      // Setup
      setupMocksForGettingRulesetModel();
      setupMocksForQueryingRulesetsWithNoResults();
      imodelMock.setup((x) => x.containsClass(RulesetElements.Ruleset.classFullName)).returns(() => true);

      // Act
      const rulesets = await embedder.getRulesets();

      // Assert
      expect(0).to.be.equal(rulesets.length);
    });
  });
});
