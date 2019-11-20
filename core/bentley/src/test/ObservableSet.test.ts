/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ObservableSet } from "../bentleyjs-core";

class Listener {
  private _added = false;
  private _deleted = false;
  private _cleared = false;

  public constructor(set: ObservableSet<string>) {
    set.onAdded.addListener((_) => this._added = true);
    set.onDeleted.addListener((_) => this._deleted = true);
    set.onCleared.addListener(() => this._cleared = true);
  }

  private clear() { this._added = this._deleted = this._cleared; }

  public expect(added: boolean, deleted: boolean, cleared: boolean, func: () => void): void {
    this.clear();
    func();
    expect(this._added).to.equal(added);
    expect(this._deleted).to.equal(deleted);
    expect(this._cleared).to.equal(cleared);
    this.clear();
  }

  public expectNone(func: () => void) { this.expect(false, false, false, func); }
  public expectAdd(func: () => void) { this.expect(true, false, false, func); }
  public expectDelete(func: () => void) { this.expect(false, true, false, func); }
  public expectClear(func: () => void) { this.expect(false, false, true, func); }
}

describe("ObservableSet", () => {
  it("should raise events only when contents change", () => {
    const set = new ObservableSet<string>();
    const listener = new Listener(set);

    listener.expectNone(() => {
      set.clear();
      set.delete("abc");
    });
    listener.expectAdd(() => set.add("abc"));
    listener.expectAdd(() => set.add("def"));
    listener.expectNone(() => set.add("abc"));
    listener.expectDelete(() => set.delete("def"));
    listener.expectClear(() => set.clear());
  });
});
