/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { IModelConnection, PropertyRecord } from "@bentley/imodeljs-frontend";
import { InstanceKey } from "../../common/lib/EC";
import { Presentation } from "@bentley/presentation-frontend";
import { KeySet, Ruleset, RegisteredRuleset, PageOptions, DefaultContentDisplayTypes, Content } from "@bentley/presentation-common";
import { ContentBuilder as PresentationContentBuilder, ContentDataProvider } from "@bentley/presentation-components";
import { using, Id64String } from "@bentley/bentleyjs-core";

/** Interface for a data provider, which is used by ContentBuilder */
export interface IContentBuilderDataProvider {
  keys: Readonly<KeySet>;
  getContentSetSize: () => Promise<number>;
  getContent: (options?: PageOptions) => Promise<Readonly<Content> | undefined>;
}

/** Property records grouped under a single className */
export interface ContentBuilderResult {
  className: string;
  records: PropertyRecord[];
}

/**
 * A class that constructs content from specified imodel and ruleset.
 */
export class ContentBuilder {
  private readonly _iModel: IModelConnection;
  private _dataProvider: IContentBuilderDataProvider | undefined;

  /**
   * Constructor
   * @param iModel The iModel to pull data from
   * @param dataProvider Custom data provider that allows mocking, what data ContentBuilder receives
   */
  constructor(iModel: IModelConnection, dataProvider?: IContentBuilderDataProvider) {
    this._iModel = iModel;
    this._dataProvider = dataProvider;
  }

  private async doCreateContent(rulesetId: string, instanceKeys: InstanceKey[], displayType: string): Promise<PropertyRecord[]> {
    const keyset = new KeySet(instanceKeys);

    const dataProvider = this._dataProvider ? this._dataProvider : new ContentDataProvider(this._iModel, rulesetId, displayType);
    dataProvider.keys = keyset;

    const contentCount = await dataProvider.getContentSetSize();
    const content = await dataProvider.getContent({ size: contentCount });

    if (!content)
      return [];

    const records: PropertyRecord[] = [];

    const sortedFields = content.descriptor.fields.sort((f1, f2) => {
      if (f1.name > f2.name)
        return -1;
      if (f1.name < f2.name)
        return 1;
      return 0;
    });

    for (const field of sortedFields) {
      for (const set of content.contentSet) {
        const record = PresentationContentBuilder.createPropertyRecord(field, set);
        records.push(record);
      }
    }

    return records;
  }

  /**
   * Create a list of property records using the supplied presentation ruleset.
   * @param rulesetOrId Either a [[Ruleset]] object or a ruleset id.
   * @param instanceKeys Keys of instances that should be queried.
   * @param displayType Type of content container display. For example:
   * "PropertyPane", "Grid", "List" etc.
   */
  public async createContent(rulesetOrId: Ruleset | string, instanceKeys: InstanceKey[], displayType: string = DefaultContentDisplayTypes.PROPERTY_PANE) {
    if (typeof rulesetOrId === "string")
      return this.doCreateContent(rulesetOrId, instanceKeys, displayType);

    return using(await Presentation.presentation.rulesets().add(rulesetOrId), async (ruleset: RegisteredRuleset) => {
      return this.doCreateContent(ruleset.id, instanceKeys, displayType);
    });
  }

  private async getECClassNames(): Promise<Array<{ schemaName: string, className: string }>> {
    return this._iModel.executeQuery(`
      SELECT s.Name schemaName, c.Name className FROM meta.ECClassDef c
      INNER JOIN meta.ECSchemaDef s ON c.Schema.id = s.ECInstanceId
      WHERE c.Modifier <> 1 AND c.Type = 0
      ORDER BY s.Name, c.Name
    `);
  }

  private async createContentForClasses(rulesetOrId: Ruleset | string, limitInstances: boolean, displayType: string) {
    const classNameEntries = await this.getECClassNames();

    const contents: ContentBuilderResult[] = [];

    for (const nameEntry of classNameEntries) {
      // try {
      const instanceIds = await this._iModel.executeQuery(`
          SELECT ECInstanceId FROM ONLY "${nameEntry.schemaName}"."${nameEntry.className}"
          ORDER BY ECInstanceId ${limitInstances ? "LIMIT 1" : ""}
        `) as Array<{ id: Id64String }>;

      if (!instanceIds.length)
        continue;

      const instanceKeys = instanceIds.map((idEntry) => ({ className: `${nameEntry.schemaName}:${nameEntry.className}`, id: idEntry.id } as InstanceKey));

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
  public async createContentForAllInstances(rulesetOrId: Ruleset | string, displayType: string = DefaultContentDisplayTypes.PROPERTY_PANE) {
    return this.createContentForClasses(rulesetOrId, false, displayType);
  }

  /**
   * Create a list of grouped property records using the supplied presentation ruleset.
   * Each group includes at most one class instance.
   * @param rulesetOrId Either a [[Ruleset]] object or a ruleset id.
   * @param displayType Type of content container display. For example:
   * "PropertyPane", "Grid", "List" etc.
   */
  public async createContentForInstancePerClass(rulesetOrId: Ruleset | string, displayType: string = DefaultContentDisplayTypes.PROPERTY_PANE) {
    return this.createContentForClasses(rulesetOrId, true, displayType);
  }
}
