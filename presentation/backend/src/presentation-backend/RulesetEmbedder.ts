/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import * as path from "path";
import { gt as versionGt, gte as versionGte, lt as versionLt } from "semver";
import type {
  DefinitionElement, ECSqlStatement, Element, Entity, IModelDb, Model} from "@itwin/core-backend";
import { DefinitionModel, DefinitionPartition, KnownLocations, Subject,
} from "@itwin/core-backend";
import type { Id64String } from "@itwin/core-bentley";
import { assert, DbResult } from "@itwin/core-bentley";
import type { DefinitionElementProps, ElementProps, InformationPartitionElementProps, ModelProps, SubjectProps} from "@itwin/core-common";
import {
  BisCodeSpec, Code, CodeScopeSpec, CodeSpec, QueryBinder,
  QueryRowFormat,
} from "@itwin/core-common";
import type { Ruleset } from "@itwin/presentation-common";
import { PresentationRules } from "./domain/PresentationRulesDomain";
import * as RulesetElements from "./domain/RulesetElements";
import { normalizeVersion } from "./Utils";

/**
 * Interface for callbacks which will be called before and after Element/Model updates
 * @beta
 */
interface UpdateCallbacks {
  onBeforeUpdate: (props: Entity) => Promise<void>;
  onAfterUpdate: (props: Entity) => Promise<void>;
}

/**
 * Interface for callbacks which will be called before and after Element/Model is inserted
 * @beta
 */
interface InsertCallbacks {
  onBeforeInsert: (props: Entity) => Promise<void>;
  onAfterInsert: (props: Entity) => Promise<void>;
}

/**
 * Options for [[RulesetEmbedder.insertRuleset]] operation.
 * @beta
 */
export interface RulesetInsertOptions {
  /**
   * When should insertion be skipped:
   * - `same-id` - if iModel already contains a ruleset with the same id and **any** version
   * - `same-id-and-version-eq` - if iModel already contains a ruleset with same id and version
   * - `same-id-and-version-gte` - if iModel already contains a ruleset with same id and
   * version greater or equal to version of the inserted ruleset.
   *
   * Defaults to `same-id-and-version-eq`.
   */
  skip?: "never" | "same-id" | "same-id-and-version-eq" | "same-id-and-version-gte";

  /**
   * Which existing versions of rulesets with same id should be replaced when we insert a new one:
   * - `all` - replace all rulesets with same id.
   * - `all-lower` - replace rulesets with same id and version lower than the version of inserted ruleset.
   * - `exact` - replace only the ruleset whose id and version matches the inserted ruleset.
   *
   * Defaults to `exact`.
   */
  replaceVersions?: "all" | "all-lower" | "exact";

  /**
   * Callbacks that will be called before and after `Entity` updates
   * @beta
   */
  onEntityUpdate?: UpdateCallbacks;

  /**
   * Callbacks that will be called before and after `Entity` is inserted
   * @beta
   */
  onEntityInsert?: InsertCallbacks;
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
   * @param ruleset Ruleset to insert.
   * @param options Options for inserting a ruleset.
   * @returns ID of inserted ruleset element or, if insertion was skipped, ID of existing ruleset with the same ID and highest version.
   */
  public async insertRuleset(ruleset: Ruleset, options?: RulesetInsertOptions): Promise<Id64String> {
    const normalizedOptions = normalizeRulesetInsertOptions(options);
    const rulesetVersion = normalizeVersion(ruleset.version);

    // ensure imodel has PresentationRules schema and required CodeSpecs
    await this.handleElementOperationPrerequisites();

    // find all rulesets with the same ID
    const rulesetsWithSameId: Array<{
      ruleset: Ruleset;
      id: Id64String;
      normalizedVersion: string;
    }> = [];
    const query = `
      SELECT ECInstanceId, JsonProperties
      FROM ${RulesetElements.Ruleset.schema.name}.${RulesetElements.Ruleset.className}
      WHERE json_extract(JsonProperties, '$.jsonProperties.id') = :rulesetId`;
    for await (const row of this._imodel.query(query, QueryBinder.from({ rulesetId: ruleset.id }), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      const existingRulesetElementId: Id64String = row.id;
      const existingRuleset: Ruleset = JSON.parse(row.jsonProperties).jsonProperties;
      rulesetsWithSameId.push({
        id: existingRulesetElementId,
        ruleset: existingRuleset,
        normalizedVersion: normalizeVersion(existingRuleset.version),
      });
    }

    // check if we need to do anything at all
    const shouldSkip = normalizedOptions.skip === "same-id" && rulesetsWithSameId.length > 0
      || normalizedOptions.skip === "same-id-and-version-eq" && rulesetsWithSameId.some((entry) => entry.normalizedVersion === rulesetVersion)
      || normalizedOptions.skip === "same-id-and-version-gte" && rulesetsWithSameId.some((entry) => versionGte(entry.normalizedVersion, rulesetVersion));
    if (shouldSkip) {
      // we're not inserting anything - return ID of the ruleset element with the highest version
      const rulesetEntryWithHighestVersion = rulesetsWithSameId.reduce((highest, curr) => {
        if (!highest.ruleset.version || curr.ruleset.version && versionGt(curr.ruleset.version, highest.ruleset.version))
          return curr;
        return highest;
      }, rulesetsWithSameId[0]);
      return rulesetEntryWithHighestVersion.id;
    }

    // if requested, delete existing rulesets
    const rulesetsToRemove: Id64String[] = [];
    const shouldRemove = (_: Ruleset, normalizedVersion: string): boolean => {
      switch (normalizedOptions.replaceVersions) {
        case "all":
          return normalizedVersion !== rulesetVersion;
        case "all-lower":
          return normalizedVersion !== rulesetVersion && versionLt(normalizedVersion, rulesetVersion);
      }
      return false;
    };
    rulesetsWithSameId.forEach((entry) => {
      if (shouldRemove(entry.ruleset, entry.normalizedVersion))
        rulesetsToRemove.push(entry.id);
    });
    this._imodel.elements.deleteElement(rulesetsToRemove);

    // attempt to update ruleset with same ID and version
    const exactMatch = rulesetsWithSameId.find((curr) => curr.normalizedVersion === rulesetVersion);
    if (exactMatch !== undefined) {
      return this.updateRuleset(exactMatch.id, ruleset, normalizedOptions.onEntityUpdate);
    }

    // no exact match found - insert a new ruleset element
    const model = await this.getOrCreateRulesetModel(normalizedOptions.onEntityInsert);
    const rulesetCode = RulesetElements.Ruleset.createRulesetCode(this._imodel, model.id, ruleset);
    return this.insertNewRuleset(ruleset, model, rulesetCode, normalizedOptions.onEntityInsert);
  }

  private async updateRuleset(elementId: Id64String, ruleset: Ruleset, callbacks?: UpdateCallbacks) {
    const existingRulesetElement = this._imodel.elements.tryGetElement<DefinitionElement>(elementId);
    assert(existingRulesetElement !== undefined);
    existingRulesetElement.jsonProperties.jsonProperties = ruleset;

    await this.updateElement(existingRulesetElement, callbacks);

    this._imodel.saveChanges();
    return existingRulesetElement.id;
  }

  private async insertNewRuleset(ruleset: Ruleset, model: Model, rulesetCode: Code, callbacks?: InsertCallbacks): Promise<Id64String> {
    const props: DefinitionElementProps = {
      model: model.id,
      code: rulesetCode,
      classFullName: RulesetElements.Ruleset.classFullName,
      jsonProperties: { jsonProperties: ruleset },
    };

    const element = await this.insertElement(props, callbacks);
    this._imodel.saveChanges();
    return element.id;
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

  private async getOrCreateRulesetModel(callbacks?: InsertCallbacks): Promise<DefinitionModel> {
    const rulesetModel = this.queryRulesetModel();
    if (undefined !== rulesetModel)
      return rulesetModel;

    const rulesetSubject = await this.insertSubject(callbacks);
    const definitionPartition = await this.insertDefinitionPartition(rulesetSubject, callbacks);
    return this.insertDefinitionModel(definitionPartition, callbacks);
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

  private async insertDefinitionModel(definitionPartition: DefinitionPartition, callbacks?: InsertCallbacks): Promise<DefinitionModel> {
    const modelProps: ModelProps = {
      modeledElement: definitionPartition,
      name: this._rulesetModelName,
      classFullName: DefinitionModel.classFullName,
      isPrivate: true,
    };

    return this.insertModel(modelProps, callbacks);
  }

  private async insertDefinitionPartition(rulesetSubject: Subject, callbacks?: InsertCallbacks): Promise<DefinitionPartition> {
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

    return this.insertElement(definitionPartitionProps, callbacks);
  }

  private async insertSubject(callbacks?: InsertCallbacks): Promise<Subject> {
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

    return this.insertElement(subjectProps, callbacks);
  }

  private async handleElementOperationPrerequisites(): Promise<void> {
    if (this._imodel.containsClass(RulesetElements.Ruleset.classFullName))
      return;

    // import PresentationRules ECSchema
    await this._imodel.importSchemas([this._schemaPath]);

    // insert CodeSpec for ruleset elements
    this._imodel.codeSpecs.insert(CodeSpec.create(this._imodel, PresentationRules.CodeSpec.Ruleset, CodeScopeSpec.Type.Model));

    this._imodel.saveChanges();
  }

  private async insertElement<TProps extends ElementProps>(props: TProps, callbacks?: InsertCallbacks): Promise<Element> {
    const element = this._imodel.elements.createElement(props);
    // istanbul ignore next
    await callbacks?.onBeforeInsert(element);
    try {
      return this._imodel.elements.getElement(element.insert());
    } finally {
      // istanbul ignore next
      await callbacks?.onAfterInsert(element);
    }
  }

  private async insertModel(props: ModelProps, callbacks?: InsertCallbacks): Promise<Model> {
    const model = this._imodel.models.createModel(props);
    // istanbul ignore next
    await callbacks?.onBeforeInsert(model);
    try {
      model.id = model.insert();
      return model;
    } finally {
      // istanbul ignore next
      await callbacks?.onAfterInsert(model);
    }
  }

  private async updateElement(element: Element, callbacks?: UpdateCallbacks) {
    // istanbul ignore next
    await callbacks?.onBeforeUpdate(element);
    try {
      element.update();
    } finally {
      // istanbul ignore next
      await callbacks?.onAfterUpdate(element);
    }
  }
}

function normalizeRulesetInsertOptions(options?: RulesetInsertOptions): RulesetInsertOptions {
  if (options === undefined)
    return { skip: "same-id-and-version-eq", replaceVersions: "exact" };

  return {
    skip: options.skip ?? "same-id-and-version-eq",
    replaceVersions: options.replaceVersions ?? "exact",
    onEntityUpdate: options.onEntityUpdate,
    onEntityInsert: options.onEntityInsert,
  };
}
