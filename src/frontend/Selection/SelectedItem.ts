/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { InstanceKey } from "@bentley/ecpresentation-common/lib/EC";

export class SelectedItem {
  private readonly _key: InstanceKey;
  constructor(key: InstanceKey) {
    this._key = key;
  }

  public get key() {
    return this._key;
  }
}
