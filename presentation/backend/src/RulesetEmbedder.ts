/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Ruleset } from "@bentley/presentation-common/lib/rules/Ruleset";
import { IModelDb } from "@bentley/imodeljs-backend/lib/IModelDb";
import { ECSqlStatement, KnownLocations, DefinitionModel, DefinitionPartition, Subject, Model, DefinitionElement } from "@bentley/imodeljs-backend";
import { DefinitionElementProps, CodeScopeSpec, CodeSpec, BisCodeSpec, Code, SubjectProps, InformationPartitionElementProps, ModelProps } from "@bentley/imodeljs-common";
import { Id64, Id64String, DbResult, ClientRequestContext } from "@bentley/bentleyjs-core";
import * as RulesetElements from "./domain/RulesetElements";
import * as path from "path";
import { PresentationRules } from "./domain/PresentationRulesDomain";

/**
 * Available strategies for handling duplicate rulesets.
 * @beta
 */
export enum DuplicateRulesetHandlingStrategy {
  Skip,
  Replace,
}

/**
 * An API for embedding presentation rulesets into iModels.
 * @beta
 */
export class RulesetEmbedder {

  private _iModelDb: IModelDb;
  private readonly _schemaPath = path.join(KnownLocations.nativeAssetsDir, "ECSchemas/Domain/PresentationRules.ecschema.xml");
  private readonly _rulesetModelName = "PresentationRules";
  private readonly _rulesetSubjectName = "PresentationRules";

  /**
   * Constructs RulesetEmbedder
   * @param iModelDb db to insert rulesets to
   */
  public constructor(iModelDb: IModelDb) {
    PresentationRules.registerSchema();
    this._iModelDb = iModelDb;
  }

  /**
   * Inserts a ruleset into iModel.
   * @param ruleset Ruleset to insert
   * @param duplicateHandlingStrategy Strategy for handling duplicate rulesets. Defaults to
   * @returns ID of inserted ruleset element
   */
  public async insertRuleset(ruleset: Ruleset, duplicateHandlingStrategy = DuplicateRulesetHandlingStrategy.Skip): Promise<Id64String> {
    await this.handleElementOperationPrerequisites();

    const model = this.getOrCreateRulesetModel();
    const rulesetCode = RulesetElements.Ruleset.createRulesetCode(model.id, ruleset.id, this._iModelDb);
    const rulesetId = this._iModelDb.elements.queryElementIdByCode(rulesetCode);
    if (rulesetId !== undefined)
      return this.handleDuplicateRuleset(ruleset, duplicateHandlingStrategy, rulesetId);

    return this.insertNewRuleset(ruleset, model, rulesetCode);
  }

  private handleDuplicateRuleset(ruleset: Ruleset, duplicateHandlingStrategy: DuplicateRulesetHandlingStrategy, rulesetId: Id64String): Id64String {
    if (DuplicateRulesetHandlingStrategy.Skip === duplicateHandlingStrategy)
      return rulesetId;

    let rulesetElement;
    try {
      rulesetElement = this._iModelDb.elements.getElement<DefinitionElement>(rulesetId);
    } catch (err) {
      return Id64.invalid;
    }

    rulesetElement.jsonProperties.jsonProperties = ruleset;
    rulesetElement.update();
    return rulesetId;
  }

  private insertNewRuleset(ruleset: Ruleset, model: Model, rulesetCode: Code): Id64String {
    const props: DefinitionElementProps = {
      model: model.id,
      code: rulesetCode,
      classFullName: RulesetElements.Ruleset.classFullName,
      jsonProperties: { jsonProperties: ruleset },
    };
    return this._iModelDb.elements.insertElement(props);
  }

  /**
   * Get all rulesets embedded in the iModel.
   */
  public async getRulesets(): Promise<Ruleset[]> {
    if (!this._iModelDb.containsClass(RulesetElements.Ruleset.classFullName))
      return [];

    const rulesetList: Ruleset[] = [];
    this._iModelDb.withPreparedStatement(`SELECT ECInstanceId AS id FROM ${RulesetElements.Ruleset.classFullName}`, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const row = statement.getRow();
        const rulesetElement = this._iModelDb.elements.getElement({ id: row.id }) as RulesetElements.Ruleset;
        const ruleset = rulesetElement.jsonProperties.jsonProperties as Ruleset;
        rulesetList.push(ruleset);
      }
    });
    return rulesetList;
  }

  private getOrCreateRulesetModel(): DefinitionModel {
    const rulesetModel = this.queryRulesetModel();
    if (undefined !== rulesetModel)
      return rulesetModel;

    const rulesetSubject: Subject = this.insertSubject();
    const definitionPartition: DefinitionPartition = this.insertDefinitionPartition(rulesetSubject);

    return this.insertDefinitionModel(definitionPartition);
  }

  private queryRulesetModel(): DefinitionModel | undefined {
    const definitionPartition = this.queryDefinitionPartition();
    if (undefined === definitionPartition)
      return undefined;

    return this._iModelDb.models.getSubModel(definitionPartition.id);
  }

  private queryDefinitionPartition(): DefinitionPartition | undefined {
    const subject = this.querySubject();
    if (undefined === subject)
      return undefined;

    return this._iModelDb.elements.getElement(DefinitionPartition.createCode(this._iModelDb, subject.id, this._rulesetModelName));
  }

  private querySubject(): DefinitionPartition | undefined {
    const root = this._iModelDb.elements.getRootSubject();
    const codeSpec: CodeSpec = this._iModelDb.codeSpecs.getByName(BisCodeSpec.subject);
    const code = new Code({
      spec: codeSpec.id,
      scope: root.id,
      value: this._rulesetSubjectName,
    });

    try {
      return this._iModelDb.elements.getElement(code);
    } catch {
      return undefined;
    }
  }

  private insertDefinitionModel(definitionPartition: DefinitionPartition): DefinitionModel {
    const modelProps: ModelProps = {
      modeledElement: definitionPartition,
      name: this._rulesetModelName,
      classFullName: DefinitionModel.classFullName,
    };

    const model = this._iModelDb.models.createModel(modelProps);
    this._iModelDb.models.insertModel(model);
    return model;
  }

  private insertDefinitionPartition(rulesetSubject: Subject): DefinitionPartition {
    const partitionCode = DefinitionPartition.createCode(this._iModelDb, rulesetSubject.id, this._rulesetModelName);
    const definitionPartitionProps: InformationPartitionElementProps = {
      parent: {
        id: rulesetSubject.id,
        relClassName: "BisCore:SubjectOwnsPartitionElements",
      },
      model: rulesetSubject.model,
      code: partitionCode,
      classFullName: DefinitionPartition.classFullName,
    };
    const id = this._iModelDb.elements.insertElement(definitionPartitionProps);
    return this._iModelDb.elements.getElement(id) as DefinitionPartition;
  }

  private insertSubject(): Subject {
    const root = this._iModelDb.elements.getRootSubject();
    const codeSpec: CodeSpec = this._iModelDb.codeSpecs.getByName(BisCodeSpec.subject);
    const subjectCode = new Code({
      spec: codeSpec.id,
      scope: root.id,
      value: this._rulesetSubjectName,
    });
    const subjectProps: SubjectProps = {
      classFullName: Subject.classFullName,
      model: root.model,
      parent: {
        id: root.id,
        relClassName: "BisCore:SubjectOwnsSubjects",
      },
      code: subjectCode,
    };
    const id = this._iModelDb.elements.insertElement(subjectProps);
    return this._iModelDb.elements.getElement(id) as Subject;
  }

  private insertCodeSpecs(): void {
    this.insertCodeSpec(PresentationRules.CodeSpec.Ruleset, CodeScopeSpec.Type.Model);
  }

  private insertCodeSpec(name: string, scopeType: CodeScopeSpec.Type): Id64String {
    const codeSpec = new CodeSpec(this._iModelDb, Id64.invalid, name, scopeType);
    return this._iModelDb.codeSpecs.insert(codeSpec);
  }

  private async handleElementOperationPrerequisites(): Promise<void> {
    if (this._iModelDb.containsClass(RulesetElements.Ruleset.classFullName))
      return;

    await this._iModelDb.importSchema(ClientRequestContext.current, this._schemaPath);
    this.insertCodeSpecs();
    this._iModelDb.saveChanges();
  }
}
