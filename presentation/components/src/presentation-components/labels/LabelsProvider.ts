/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayLabels
 */

import memoize from "micro-memoize";
import { IModelConnection } from "@itwin/core-frontend";
import { DEFAULT_KEYS_BATCH_SIZE, InstanceKey, LabelDefinition } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";

/**
 * Interface for presentation rules-driven labels provider.
 * @public
 */
export interface IPresentationLabelsProvider {
  /** [[IModelConnection]] used by this data provider */
  readonly imodel: IModelConnection;
  /**
   * Get label for instance identified with the given key.
   */
  getLabel(key: InstanceKey): Promise<string>;
  /**
   * Get labels for instances identified with the given keys.
   */
  getLabels(keys: InstanceKey[]): Promise<string[]>;
}

/**
 * Properties for creating a `LabelsProvider` instance.
 * @public
 */
export interface PresentationLabelsProviderProps {
  /** IModel to pull data from. */
  imodel: IModelConnection;
}

/**
 * Presentation Rules-driven labels provider implementation.
 * @public
 */
export class PresentationLabelsProvider implements IPresentationLabelsProvider {

  public readonly imodel: IModelConnection;

  /** Constructor. */
  constructor(props: PresentationLabelsProviderProps) {
    this.imodel = props.imodel;
  }

  private async getLabelInternal(key: InstanceKey) {
    return (await Presentation.presentation.getDisplayLabelDefinition({ imodel: this.imodel, key })).displayValue; // WIP
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private getMemoizedLabel = memoize(this.getLabelInternal, { isMatchingKey: MemoizationHelpers.areLabelRequestsEqual as any });

  /**
   * Returns label for the specified instance key. Memoizes *the last* response.
   * @param key Key of instance to get label for
   */
  public async getLabel(key: InstanceKey): Promise<string> {
    return this.getMemoizedLabel(key);
  }

  private async getLabelsInternal(keys: InstanceKey[]) {
    const labelPromises = new Array<Promise<LabelDefinition[]>>();
    const tempKeys = [...keys];

    while (tempKeys.length) {
      const batch = tempKeys.splice(0, DEFAULT_KEYS_BATCH_SIZE);
      labelPromises.push(Presentation.presentation.getDisplayLabelDefinitions({ imodel: this.imodel, keys: batch }));
    }

    return (await Promise.all(labelPromises)).reduce((displayValues, labels) => {
      displayValues.push(...labels.map((def) => def.displayValue));
      return displayValues;
    }, new Array<string>());
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private getMemoizedLabels = memoize(this.getLabelsInternal, { isMatchingKey: MemoizationHelpers.areLabelsRequestsEqual as any });

  /**
   * Returns labels for the specified instance keys. Memoizes *the last* response.
   * @param keys Keys of instances to get labels for
   */
  public async getLabels(keys: InstanceKey[]): Promise<string[]> {
    return this.getMemoizedLabels(keys);
  }
}

class MemoizationHelpers {
  private static areInstanceKeysEqual(lhs: InstanceKey, rhs: InstanceKey) {
    return (lhs.className === rhs.className && lhs.id === rhs.id);
  }
  public static areLabelRequestsEqual(lhsArgs: [InstanceKey], rhsArgs: [InstanceKey]): boolean {
    return MemoizationHelpers.areInstanceKeysEqual(lhsArgs[0], rhsArgs[0]);
  }
  public static areLabelsRequestsEqual(lhsArgs: [InstanceKey[]], rhsArgs: [InstanceKey[]]): boolean {
    return lhsArgs[0].length === rhsArgs[0].length
      && lhsArgs[0].every((key, index) => MemoizationHelpers.areInstanceKeysEqual(key, rhsArgs[0][index]));
  }
}
