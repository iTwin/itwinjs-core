/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString } from "@bentley/bentleyjs-core";
import { QuantityTypeKey, UnitSystemKey } from "@bentley/imodeljs-frontend";
import { FormatProps } from "@bentley/imodeljs-quantity";

/** @alpha */
export interface QuantityOverridesManager {
  store (iModelId: string, unitSystemKey: UnitSystemKey, quantityTypeKey: QuantityTypeKey, formatProps: FormatProps): Promise<boolean>;
  retrieve (iModelId: string, unitSystemKey: UnitSystemKey, quantityTypeKey: QuantityTypeKey): Promise<FormatProps|undefined>;
  remove (iModelId: string, unitSystemKey: UnitSystemKey, quantityTypeKey: QuantityTypeKey): Promise<boolean>;
}

/** @alpha */
export class AppQuantityOverridesManager {
  private buildKey(iModelId: GuidString, unitSystemKey: UnitSystemKey, quantityTypeKey: QuantityTypeKey) {
    return `quantityTypeFormat#i:${iModelId}#u:${unitSystemKey}#q:${quantityTypeKey}`;
  }

  public async store(iModelId: GuidString, unitSystemKey: UnitSystemKey, quantityTypeKey: QuantityTypeKey, formatProps: FormatProps): Promise<boolean> {
    try {
      localStorage.setItem (this.buildKey(iModelId,unitSystemKey,quantityTypeKey), JSON.stringify(formatProps));
      return true;
    } catch (_e) {
      return false;
    }
  }

  public async retrieve(iModelId: GuidString, unitSystemKey: UnitSystemKey, quantityTypeKey: QuantityTypeKey): Promise<FormatProps|undefined> {
    const storedFormat = localStorage.getItem (this.buildKey(iModelId,unitSystemKey,quantityTypeKey));
    if (storedFormat) {
      JSON.parse(storedFormat);
    }

    return undefined;
  }

  public async remove(iModelId: GuidString, unitSystemKey: UnitSystemKey, quantityTypeKey: QuantityTypeKey): Promise<boolean> {
    const key = this.buildKey(iModelId,unitSystemKey,quantityTypeKey);
    if (localStorage.getItem(key)) {
      localStorage.removeItem (key);
      return true;
    }

    return false;
  }
}
