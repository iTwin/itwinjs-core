/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@itwin/core-bentley";

/** @internal */
export class CachingElementIdsContainer {
  private _ids = new Array<Id64String>();
  constructor(private _generator: AsyncGenerator<Id64String>) {
  }

  private async next() {return (await this._generator.next()).value;}

  public async* getElementIds() {
    for (const id of this._ids) {
      yield id;
    }

    let nextId;
    while (nextId = await this.next()) {
      this._ids.push(nextId);
      yield nextId;
    }
  }
}
