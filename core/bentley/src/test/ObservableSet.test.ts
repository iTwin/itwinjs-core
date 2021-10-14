/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ObservableSet } from "../core-bentley";

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

  it("should construct from iterable", () => {
    // Original problem:
    //  Set constructor invokes add(), which ObservableSet overrides to raise an event.
    //  The event is undefined until Set constructor finishes, producing an exception.
    // Solution: suppress events during construction - no listeners can be registered yet anyway.
    const elems = ["a", "b", "c"];
    const observable = new ObservableSet<string>(elems);
    const set = new Set<string>(elems);
    expect(observable).to.deep.equal(set);
  });
});
