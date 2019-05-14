/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module DisplayLabels */

import * as _ from "lodash";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { InstanceKey } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";

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
 * Presentation Rules-driven labels provider implementation.
 * @public
 */
export class LabelsProvider implements IPresentationLabelsProvider {

  public readonly imodel: IModelConnection;

  /** Constructor. */
  constructor(imodel: IModelConnection) {
    this.imodel = imodel;
  }

  private async getLabelInternal(key: InstanceKey) {
    return Presentation.presentation.getDisplayLabel({ imodel: this.imodel }, key);
  }

  // tslint:disable-next-line:naming-convention
  private getMemoizedLabel = _.memoize(this.getLabelInternal, (k) => JSON.stringify(k));

  /**
   * Returns label for the specified instance key
   * @param key Key of instance to get label for
   * @param memoize Should the result the memoized by the provider.
   */
  public async getLabel(key: InstanceKey, memoize = false): Promise<string> {
    return memoize ? this.getMemoizedLabel(key) : this.getLabelInternal(key);
  }

  private async getLabelsInternal(keys: InstanceKey[]) {
    return Presentation.presentation.getDisplayLabels({ imodel: this.imodel }, keys);
  }

  // tslint:disable-next-line:naming-convention
  private getMemoizedLabels = _.memoize(this.getLabelsInternal, (k) => JSON.stringify(k));

  /**
   * Returns labels for the specified instance keys.
   * @param keys Keys of instances to get labels for
   * @param memoize Should the result be memoized by the provider.
   */
  public async getLabels(keys: InstanceKey[], memoize = false): Promise<string[]> {
    return memoize ? this.getMemoizedLabels(keys) : this.getLabelsInternal(keys);
  }
}
