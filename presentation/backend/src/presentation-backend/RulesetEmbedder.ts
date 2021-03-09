/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import * as path from "path";
import { ClientRequestContext, DbResult, Id64, Id64String } from "@bentley/bentleyjs-core";
import {
  DefinitionElement, DefinitionModel, DefinitionPartition, ECSqlStatement, IModelDb, KnownLocations, Model, Subject,
} from "@bentley/imodeljs-backend";
import {
  BisCodeSpec, Code, CodeScopeSpec, CodeSpec, DefinitionElementProps, InformationPartitionElementProps, ModelProps, SubjectProps,
} from "@bentley/imodeljs-common";
import { Ruleset } from "@bentley/presentation-common";
import { PresentationRules } from "./domain/PresentationRulesDomain";
import * as RulesetElements from "./domain/RulesetElements";

/**
 * Available strategies for handling duplicate rulesets.
 * @beta
 */
export enum DuplicateRulesetHandlingStrategy {
  Skip,
  Replace,
}

/**
 * Properties for creating a `RulesetEmbedder` instance.
 * @public
 */
export interface RulesetEmbedderProps {
  /** iModel to embed rulesets to */
  imodel: IModelDb;
}

/**
 * An API for embedding presentation rulesets into iModels.
 * @beta
 */
export class RulesetEmbedder {

  private _imodel: IModelDb;
  private readonly _schemaPath = path.join(KnownLocations.nativeAssetsDir, "ECSchemas/Domain/PresentationRules.ecschema.xml");
  private readonly _rulesetModelName = "PresentationRules";
  private readonly _rulesetSubjectName = "PresentationRules";

  /**
   * Constructs RulesetEmbedder
   */
  public constructor(props: RulesetEmbedderProps) {
    PresentationRules.registerSchema();
    this._imodel = props.imodel;
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
    const rulesetCode = RulesetElements.Ruleset.createRulesetCode(model.id, ruleset.id, this._imodel);
    const rulesetId = this._imodel.elements.queryElementIdByCode(rulesetCode);
    if (rulesetId !== undefined)
      return this.handleDuplicateRuleset(ruleset, duplicateHandlingStrategy, rulesetId);

    return this.insertNewRuleset(ruleset, model, rulesetCode);
  }

  private handleDuplicateRuleset(ruleset: Ruleset, duplicateHandlingStrategy: DuplicateRulesetHandlingStrategy, rulesetId: Id64String): Id64String {
    if (DuplicateRulesetHandlingStrategy.Skip === duplicateHandlingStrategy)
      return rulesetId;

    const rulesetElement = this._imodel.elements.tryGetElement<DefinitionElement>(rulesetId);
    if (!rulesetElement)
      return Id64.invalid;

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
    return this._imodel.elements.insertElement(props);
  }

  /**
   * Get all rulesets embedded in the iModel.
   */
  public async getRulesets(): Promise<Ruleset[]> {
    if (!this._imodel.containsClass(RulesetElements.Ruleset.classFullName))
      return [];

    const rulesetList: Ruleset[] = [];
    this._imodel.withPreparedStatement(`SELECT ECInstanceId AS id FROM ${RulesetElements.Ruleset.classFullName}`, (statement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const row = statement.getRow();
        const rulesetElement = this._imodel.elements.getElement({ id: row.id });
        const ruleset = rulesetElement.jsonProperties.jsonProperties;
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

    return this._imodel.models.getSubModel(definitionPartition.id);
  }

  private queryDefinitionPartition(): DefinitionPartition | undefined {
    const subject = this.querySubject();
    if (undefined === subject)
      return undefined;

    return this._imodel.elements.tryGetElement<DefinitionPartition>(DefinitionPartition.createCode(this._imodel, subject.id, this._rulesetModelName));
  }

  private querySubject(): DefinitionPartition | undefined {
    const root = this._imodel.elements.getRootSubject();
    const codeSpec: CodeSpec = this._imodel.codeSpecs.getByName(BisCodeSpec.subject);
    const code = new Code({
      spec: codeSpec.id,
      scope: root.id,
      value: this._rulesetSubjectName,
    });

    return this._imodel.elements.tryGetElement<DefinitionPartition>(code);
  }

  private insertDefinitionModel(definitionPartition: DefinitionPartition): DefinitionModel {
    const modelProps: ModelProps = {
      modeledElement: definitionPartition,
      name: this._rulesetModelName,
      classFullName: DefinitionModel.classFullName,
    };

    const model = this._imodel.models.createModel(modelProps);
    this._imodel.models.insertModel(model);
    return model;
  }

  private insertDefinitionPartition(rulesetSubject: Subject): DefinitionPartition {
    const partitionCode = DefinitionPartition.createCode(this._imodel, rulesetSubject.id, this._rulesetModelName);
    const definitionPartitionProps: InformationPartitionElementProps = {
      parent: {
        id: rulesetSubject.id,
        relClassName: "BisCore:SubjectOwnsPartitionElements",
      },
      model: rulesetSubject.model,
      code: partitionCode,
      classFullName: DefinitionPartition.classFullName,
    };
    const id = this._imodel.elements.insertElement(definitionPartitionProps);
    return this._imodel.elements.getElement(id);
  }

  private insertSubject(): Subject {
    const root = this._imodel.elements.getRootSubject();
    const codeSpec: CodeSpec = this._imodel.codeSpecs.getByName(BisCodeSpec.subject);
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
    const id = this._imodel.elements.insertElement(subjectProps);
    return this._imodel.elements.getElement(id);
  }

  private insertCodeSpecs(): void {
    this.insertCodeSpec(PresentationRules.CodeSpec.Ruleset, CodeScopeSpec.Type.Model);
  }

  private insertCodeSpec(name: string, scopeType: CodeScopeSpec.Type): Id64String {
    const codeSpec = CodeSpec.create(this._imodel, name, scopeType);
    return this._imodel.codeSpecs.insert(codeSpec);
  }

  private async handleElementOperationPrerequisites(): Promise<void> {
    if (this._imodel.containsClass(RulesetElements.Ruleset.classFullName))
      return;

    await this._imodel.importSchemas(ClientRequestContext.current, [this._schemaPath]);
    this.insertCodeSpecs();
    this._imodel.saveChanges();
  }
}
