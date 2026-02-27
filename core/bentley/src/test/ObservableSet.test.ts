/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { ObservableSet } from "../core-bentley";

class Listener {
  private _added = false;
  private _deleted = false;
  private _cleared = false;
  private _addCount = 0;
  private _deleteCount = 0;
  private _batchAddCount = 0;
  private _batchDeleteCount = 0;

  public constructor(set: ObservableSet<string>) {
    set.onAdded.addListener((_) => { this._added = true; this._addCount++; });
    set.onDeleted.addListener((_) => { this._deleted = true; this._deleteCount++; });
    set.onCleared.addListener(() => this._cleared = true);
    set.onBatchAdded.addListener(() => this._batchAddCount++);
    set.onBatchDeleted.addListener(() => this._batchDeleteCount++);
  }

  private clear() {
    this._added = this._deleted = this._cleared = false;
    this._addCount = this._deleteCount = this._batchAddCount = this._batchDeleteCount = 0;
  }

  public expect(added: boolean, deleted: boolean, cleared: boolean, func: () => void): void {
    this.clear();
    func();
    expect(this._added).to.equal(added);
    expect(this._deleted).to.equal(deleted);
    expect(this._cleared).to.equal(cleared);
    this.clear();
  }

  public expectBatch(batchAddCount: number, batchDeleteCount: number, func: () => void): void {
    this.clear();
    func();
    expect(this._batchAddCount).to.equal(batchAddCount);
    expect(this._batchDeleteCount).to.equal(batchDeleteCount);
    expect(this._addCount).to.equal(0);
    expect(this._deleteCount).to.equal(0);
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

  it("addAll should raise onBatchAdded only once", () => {
    const set = new ObservableSet<string>();
    const listener = new Listener(set);

    listener.expectBatch(1, 0, () => {
      const count = set.addAll(["a", "b", "c"]);
      expect(count).to.equal(3);
    });
    expect(set.size).to.equal(3);
  });

  it("addAll should not raise any event for empty iterable", () => {
    const set = new ObservableSet<string>();
    const listener = new Listener(set);

    listener.expectBatch(0, 0, () => {
      const count = set.addAll([]);
      expect(count).to.equal(0);
    });
  });

  it("addAll should not raise event when all items already exist", () => {
    const set = new ObservableSet<string>(["a", "b"]);
    const listener = new Listener(set);

    listener.expectBatch(0, 0, () => {
      const count = set.addAll(["a", "b"]);
      expect(count).to.equal(0);
    });
    expect(set.size).to.equal(2);
  });

  it("addAll should count only newly added items", () => {
    const set = new ObservableSet<string>(["a"]);
    const listener = new Listener(set);

    listener.expectBatch(1, 0, () => {
      const count = set.addAll(["a", "b", "c"]);
      expect(count).to.equal(2);
    });
    expect(set.size).to.equal(3);
  });

  it("deleteAll should raise onBatchDeleted only once", () => {
    const set = new ObservableSet<string>(["a", "b", "c"]);
    const listener = new Listener(set);

    listener.expectBatch(0, 1, () => {
      const count = set.deleteAll(["a", "b", "c"]);
      expect(count).to.equal(3);
    });
    expect(set.size).to.equal(0);
  });

  it("deleteAll should not raise any event for empty iterable", () => {
    const set = new ObservableSet<string>(["a"]);
    const listener = new Listener(set);

    listener.expectBatch(0, 0, () => {
      const count = set.deleteAll([]);
      expect(count).to.equal(0);
    });
    expect(set.size).to.equal(1);
  });

  it("deleteAll should not raise event when no items exist in set", () => {
    const set = new ObservableSet<string>(["a"]);
    const listener = new Listener(set);

    listener.expectBatch(0, 0, () => {
      const count = set.deleteAll(["x", "y"]);
      expect(count).to.equal(0);
    });
    expect(set.size).to.equal(1);
  });

  it("deleteAll should count only actually deleted items", () => {
    const set = new ObservableSet<string>(["a", "b"]);
    const listener = new Listener(set);

    listener.expectBatch(0, 1, () => {
      const count = set.deleteAll(["a", "x"]);
      expect(count).to.equal(1);
    });
    expect(set.size).to.equal(1);
    expect(set.has("b")).to.be.true;
  });
});
