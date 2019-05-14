/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { RulesetsFactory, Omit } from "@bentley/presentation-common";
import { PropertyRecord } from "@bentley/imodeljs-frontend";
import { IPresentationPropertyDataProvider } from "./propertygrid/DataProvider";
import {
  IPresentationTableDataProvider, PresentationTableDataProvider,
  PresentationTableDataProviderProps,
} from "./table/DataProvider";

/**
 * Data structure holding initialization properties for [[DataProvidersFactory]]
 * @public
 */
export interface DataProvidersFactoryProps {
  /** Rulesets' factory to use when creating data providers */
  rulesetsFactory?: RulesetsFactory;
}

/**
 * A factory class than can be used to create presentation data providers targeted towards
 * specific use cases.
 *
 * @public
 */
export class DataProvidersFactory {
  private _rulesetsFactory: RulesetsFactory;

  /** Constructor. */
  public constructor(props?: DataProvidersFactoryProps) {
    this._rulesetsFactory = props && props.rulesetsFactory ? props.rulesetsFactory : new RulesetsFactory();
  }

  /**
   * Create a table data provider which returns instances of the same class and
   * having the same property value as the provided property record.
   * @param propertiesProvider A field identifying which property of the record we should use
   * @param record A record whose similar instances should be found
   * @param props Configuration properties for the created provider
   */
  public async createSimilarInstancesTableDataProvider(propertiesProvider: IPresentationPropertyDataProvider, record: PropertyRecord,
    props: Omit<PresentationTableDataProviderProps, "imodel" | "ruleset">,
  ): Promise<IPresentationTableDataProvider & { description: string }> {
    const content = await propertiesProvider.getContent();
    if (!content || content.contentSet.length === 0)
      throw new Error("Properties provider has no content. Where did record come from?");

    const field = content.descriptor.getFieldByName(record.property.name, true);
    if (!field)
      throw new Error("Properties provider doesn't have a property with provided record. Where did record come from?");

    const result = this._rulesetsFactory.createSimilarInstancesRuleset(field, content.contentSet[0]);
    return new TableDataProviderWithDescription({
      ...props,
      imodel: propertiesProvider.imodel,
      ruleset: result.ruleset,
      description: result.description,
    });
  }
}

class TableDataProviderWithDescription extends PresentationTableDataProvider {
  public readonly description: string;
  public constructor(props: (PresentationTableDataProviderProps & { description: string })) {
    const { description, ...baseProps } = props;
    super(baseProps);
    this.description = description;
  }
  protected shouldRequestContentForEmptyKeyset() { return true; }
}
