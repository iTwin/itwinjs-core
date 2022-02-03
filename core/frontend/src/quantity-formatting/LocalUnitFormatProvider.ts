/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormatting
 */

import type { UnitSystemKey } from "@itwin/core-quantity";
import type { OverrideFormatEntry, QuantityFormatter, QuantityTypeKey } from "./QuantityFormatter";
import { BaseUnitFormattingSettingsProvider } from "./BaseUnitFormattingSettingsProvider";

/** Implementation of BaseUnitFormattingSettingsProvider that stores and retrieves data in local storage.
 *  @beta
 */
export class LocalUnitFormatProvider extends BaseUnitFormattingSettingsProvider {
  /** If `maintainOverridesPerIModel` is true, the base class will set up listeners to monitor active iModel
   *  changes so the overrides for the QuantityFormatter properly match the overrides set up by the user. */
  constructor(quantityFormatter: QuantityFormatter, maintainOverridesPerIModel?: boolean) {
    super (quantityFormatter, maintainOverridesPerIModel);
  }

  private buildUnitSystemKey() {
    if (this.imodelConnection)
      return `unitsystem#i:${this.imodelConnection.iModelId}`;
    return `unitsystem#user`;
  }

  public async retrieveUnitSystem(defaultKey: UnitSystemKey): Promise<UnitSystemKey> {
    const readUnitSystem = localStorage.getItem (this.buildUnitSystemKey());
    if (readUnitSystem && readUnitSystem.length) {
      return readUnitSystem as UnitSystemKey;
    }

    return defaultKey;
  }

  public async storeUnitSystemKey(unitSystemKey: UnitSystemKey): Promise<boolean> {
    try {
      localStorage.setItem (this.buildUnitSystemKey(), unitSystemKey);
      return true;
    } catch (_e) {
      return false;
    }
  }

  private buildOverridesKey(quantityTypeKey: QuantityTypeKey) {
    if (this.imodelConnection)
      return `quantityTypeFormat#i:${this.imodelConnection.iModelId}#q:${quantityTypeKey}`;
    return `quantityTypeFormat#user#q:${quantityTypeKey}`;
  }

  public async store(quantityTypeKey: QuantityTypeKey, overrideProps: OverrideFormatEntry): Promise<boolean> {
    try {
      localStorage.setItem (this.buildOverridesKey(quantityTypeKey), JSON.stringify(overrideProps));
      return true;
    } catch (_e) {
      return false;
    }
  }

  public async retrieve(quantityTypeKey: QuantityTypeKey): Promise<OverrideFormatEntry|undefined> {
    const storedFormat = localStorage.getItem (this.buildOverridesKey(quantityTypeKey));
    if (storedFormat) {
      return JSON.parse(storedFormat);
    }

    return undefined;
  }

  public async remove(quantityTypeKey: QuantityTypeKey): Promise<boolean> {
    const key = this.buildOverridesKey(quantityTypeKey);
    if (localStorage.getItem(key)) {
      localStorage.removeItem (key);
      return true;
    }

    return false;
  }
}
