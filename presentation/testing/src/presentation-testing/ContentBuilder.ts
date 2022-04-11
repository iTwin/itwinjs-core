/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { PropertyRecord } from "@itwin/appui-abstract";
/** @packageDocumentation
 * @module Content
 */
import { using } from "@itwin/core-bentley";
import { QueryRowFormat } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import {
  Content, DefaultContentDisplayTypes, InstanceKey, KeySet, PageOptions, ProcessPrimitiveValueProps, RegisteredRuleset, Ruleset, traverseContent,
  Value, ValuesMap,
} from "@itwin/presentation-common";
import { ContentDataProvider, FieldHierarchyRecord, PropertyRecordsBuilder } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";

/**
 * Interface for a data provider, which is used by ContentBuilder.
 * @public
 */
export interface IContentBuilderDataProvider {
  /** Keys the data provider is creating content for */
  keys: Readonly<KeySet>;
  /** Get the size of content result set */
  getContentSetSize: () => Promise<number>;
  /** Get the content */
  getContent: (options?: PageOptions) => Promise<Readonly<Content> | undefined>;
}

/**
 * Property records grouped under a single className
 * @public
 */
export interface ContentBuilderResult {
  /** Full name of ECClass whose records are contained in this data structure */
  className: string;
  /** Property records for the ECClass instance */
  records: PropertyRecord[];
}

/**
 * Properties for creating a `ContentBuilder` instance.
 * @public
 */
export interface ContentBuilderProps {
  /** The iModel to pull data from */
  imodel: IModelConnection;

  /** Custom data provider that allows mocking data ContentBuilder receives */
  dataProvider?: IContentBuilderDataProvider;

  /**
   * Decimal precision or numeric types.
   *
   * Raw numeric values with high precision may slightly differ from platform to platform due to
   * rounding differences on different platforms. This may be a problem when used with snapshot testing,
   * in which case this attribute may be set to supply the maximum precision of raw numeric values.
   *
   * By default no rounding is applied.
   */
  decimalPrecision?: number;
}

/**
 * A class that constructs content from specified imodel and ruleset.
 * @public
 */
export class ContentBuilder {
  private readonly _iModel: IModelConnection;
  private _dataProvider: IContentBuilderDataProvider | undefined;
  private _decimalPrecision?: number;

  /**
   * Constructor
   * @param iModel
   * @param dataProvider
   */
  constructor(props: ContentBuilderProps) {
    this._iModel = props.imodel;
    this._dataProvider = props.dataProvider;
    this._decimalPrecision = props.decimalPrecision;
  }

  private async doCreateContent(rulesetId: string, instanceKeys: InstanceKey[], displayType: string): Promise<PropertyRecord[]> {
    const dataProvider = this._dataProvider ? this._dataProvider : new ContentDataProvider({ imodel: this._iModel, ruleset: rulesetId, displayType });
    dataProvider.keys = new KeySet(instanceKeys);

    const content = await dataProvider.getContent();
    if (!content)
      return [];

    const accumulator = new PropertyRecordsAccumulator(this._decimalPrecision);
    traverseContent(accumulator, content);
    return accumulator.records;
  }

  /**
   * Create a list of property records using the supplied presentation ruleset.
   * @param rulesetOrId Either a [[Ruleset]] object or a ruleset id.
   * @param instanceKeys Keys of instances that should be queried.
   * @param displayType Type of content container display. For example:
   * "PropertyPane", "Grid", "List" etc.
   */
  public async createContent(rulesetOrId: Ruleset | string, instanceKeys: InstanceKey[], displayType: string = DefaultContentDisplayTypes.PropertyPane) {
    if (typeof rulesetOrId === "string")
      return this.doCreateContent(rulesetOrId, instanceKeys, displayType);

    return using(await Presentation.presentation.rulesets().add(rulesetOrId), async (ruleset: RegisteredRuleset) => {
      return this.doCreateContent(ruleset.id, instanceKeys, displayType);
    });
  }

  private async getECClassNames(): Promise<Array<{ schemaName: string, className: string }>> {
    const rows = [];
    for await (const row of this._iModel.query(`
      SELECT s.Name schemaName, c.Name className FROM meta.ECClassDef c
      INNER JOIN meta.ECSchemaDef s ON c.Schema.id = s.ECInstanceId
      WHERE c.Modifier <> 1 AND c.Type = 0
      ORDER BY s.Name, c.Name
    `, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      rows.push(row);
    }
    return rows;
  }

  private async createContentForClasses(rulesetOrId: Ruleset | string, limitInstances: boolean, displayType: string) {
    const classNameEntries = await this.getECClassNames();

    const contents: ContentBuilderResult[] = [];

    for (const nameEntry of classNameEntries) {
      // try {
      const instanceIds = [];
      for await (const row of this._iModel.query(`
      SELECT ECInstanceId FROM ONLY "${nameEntry.schemaName}"."${nameEntry.className}"
      ORDER BY ECInstanceId`, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames, limit: { count: limitInstances ? 1 : 4000 } })) {
        instanceIds.push(row.id);
      }

      if (!instanceIds.length)
        continue;

      const instanceKeys = instanceIds.map((idEntry) => ({ className: `${nameEntry.schemaName}:${nameEntry.className}`, id: idEntry } as InstanceKey));

      contents.push({
        className: `${nameEntry.schemaName}:${nameEntry.className}`,
        records: await this.createContent(rulesetOrId, instanceKeys, displayType),
      });
    }

    return contents;
  }

  /**
   * Create a list of grouped property records using the supplied presentation ruleset.
   * Each group includes all of the class instances.
   * @param rulesetOrId Either a [[Ruleset]] object or a ruleset id.
   * @param displayType Type of content container display. For example:
   * "PropertyPane", "Grid", "List" etc.
   */
  public async createContentForAllInstances(rulesetOrId: Ruleset | string, displayType: string = DefaultContentDisplayTypes.PropertyPane) {
    return this.createContentForClasses(rulesetOrId, false, displayType);
  }

  /**
   * Create a list of grouped property records using the supplied presentation ruleset.
   * Each group includes at most one class instance.
   * @param rulesetOrId Either a [[Ruleset]] object or a ruleset id.
   * @param displayType Type of content container display. For example:
   * "PropertyPane", "Grid", "List" etc.
   */
  public async createContentForInstancePerClass(rulesetOrId: Ruleset | string, displayType: string = DefaultContentDisplayTypes.PropertyPane) {
    return this.createContentForClasses(rulesetOrId, true, displayType);
  }
}

class PropertyRecordsAccumulator extends PropertyRecordsBuilder {
  private _records: PropertyRecord[] = [];
  private _decimalPrecision?: number;

  public constructor(decimalPrecision?: number) {
    super();
    this._decimalPrecision = decimalPrecision;
  }

  public get records(): PropertyRecord[] {
    return this._records;
  }

  protected createRootPropertiesAppender() {
    return {
      append: (record: FieldHierarchyRecord) => {
        this._records.push(record.record);
      },
    };
  }

  private processRawValue(value: Value): Value {
    if (this._decimalPrecision === undefined)
      return value;

    if (typeof value === "number") {
      return +(Number(value)).toFixed(this._decimalPrecision);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.processRawValue(item));
    }

    if (value instanceof Object) {
      const res: ValuesMap = {};
      Object.entries(value).forEach(([key, memberValue]) => {
        res[key] = this.processRawValue(memberValue);
      });
      return res;
    }

    return value;
  }

  public override processPrimitiveValue(props: ProcessPrimitiveValueProps) {
    super.processPrimitiveValue({ ...props, rawValue: this.processRawValue(props.rawValue) });
  }
}
