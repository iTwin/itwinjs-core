/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { ObservableMap } from "../core-bentley";

class Listener {
  private _added = false;
  private _deleted = false;
  private _cleared = false;
  private _changed = false;
  private _addCount = 0;
  private _deleteCount = 0;
  private _batchAddCount = 0;
  private _batchDeleteCount = 0;

  public constructor(map: ObservableMap<string, any>) {
    map.onAdded.addListener((_, __) => { this._added = true; this._addCount++; });
    map.onDeleted.addListener((_) => { this._deleted = true; this._deleteCount++; });
    map.onCleared.addListener(() => this._cleared = true);
    map.onChanged.addListener(() => { this._changed = true; });
    map.onBatchAdded.addListener(() => this._batchAddCount++);
    map.onBatchDeleted.addListener(() => this._batchDeleteCount++);
  }

  private clear() {
    this._added = this._deleted = this._cleared = this._changed = false;
    this._addCount = this._deleteCount = this._batchAddCount = this._batchDeleteCount = 0;
  }

  public expect(added: boolean, deleted: boolean, cleared: boolean, func: () => void): void {
    this.clear();
    func();
    expect(this._added).to.equal(added);
    expect(this._deleted).to.equal(deleted);
    expect(this._cleared).to.equal(cleared);
    const deducedChanged = added || deleted || cleared;
    expect(this._changed).to.equal(deducedChanged);
    this.clear();
  }

  public expectBatch(batchAddCount: number, batchDeleteCount: number, func: () => void): void {
    this.clear();
    func();
    expect(this._batchAddCount).to.equal(batchAddCount);
    expect(this._batchDeleteCount).to.equal(batchDeleteCount);
    expect(this._addCount).to.equal(0);
    expect(this._deleteCount).to.equal(0);
    const deducedChanged = batchAddCount > 0 || batchDeleteCount > 0;
    expect(this._changed).to.equal(deducedChanged);
    this.clear();
  }

  public expectNone(func: () => void) { this.expect(false, false, false, func); }
  public expectAdd(func: () => void) { this.expect(true, false, false, func); }
  public expectDelete(func: () => void) { this.expect(false, true, false, func); }
  public expectClear(func: () => void) { this.expect(false, false, true, func); }
}

describe("ObservableMap", () => {
  it("should raise events only when contents change", () => {
    const map = new ObservableMap<string, string>();
    const listener = new Listener(map);

    listener.expectNone(() => {
      map.clear();
      map.delete("abc");
    });

    listener.expectAdd(() => map.set("abc", "1"));
    listener.expectAdd(() => map.set("def", "2"));
    listener.expectNone(() => map.set("abc", "3"));
    listener.expectDelete(() => map.delete("def"));
    listener.expectClear(() => map.clear());
  });

  it("should construct from iterable", () => {
    // Map constructor invokes set(), which ObservableMap overrides to raise an event.
    // The event is undefined until Map constructor finishes, producing an exception.
    // Solution: suppress events during construction - no listeners can be registered yet anyway.
    const elems: Array<readonly [string, string]> = [["a", "1"], ["b", "2"], ["c", "3"]];
    const observable = new ObservableMap<string, string>(elems);
    const map = new Map<string, string>(elems);
    expect(Array.from(observable.entries())).to.deep.equal(Array.from(map.entries()));
  });

  it("setAll should raise onBatchAdded only once", () => {
    const map = new ObservableMap<string, string>();
    const listener = new Listener(map);

    listener.expectBatch(1, 0, () => {
      const count = map.setAll([["a", "1"], ["b", "2"], ["c", "3"]]);
      expect(count).to.equal(3);
    });
    expect(map.size).to.equal(3);
  });

  it("setAll should not raise any event for empty iterable", () => {
    const map = new ObservableMap<string, string>();
    const listener = new Listener(map);

    listener.expectBatch(0, 0, () => {
      const count = map.setAll([]);
      expect(count).to.equal(0);
    });
  });

  it("setAll should not raise event when all keys already exist", () => {
    const map = new ObservableMap<string, string>([["a", "1"], ["b", "2"]]);
    const listener = new Listener(map);

    listener.expectBatch(0, 0, () => {
      const count = map.setAll([["a", "1"], ["b", "2"]]);
      expect(count).to.equal(0);
    });
    expect(map.size).to.equal(2);
  });

  it("setAll should count only newly added items", () => {
    const map = new ObservableMap<string, string>([["a", "1"]]);
    const listener = new Listener(map);

    listener.expectBatch(1, 0, () => {
      const count = map.setAll([["a", "1"], ["b", "2"], ["c", "3"]]);
      expect(count).to.equal(2);
    });
    expect(map.size).to.equal(3);
  });

  it("deleteAll should raise onBatchDeleted only once", () => {
    const map = new ObservableMap<string, string>([["a", "1"], ["b", "2"], ["c", "3"]]);
    const listener = new Listener(map);

    listener.expectBatch(0, 1, () => {
      const count = map.deleteAll(["a", "b", "c"]);
      expect(count).to.equal(3);
    });
    expect(map.size).to.equal(0);
  });

  it("deleteAll should not raise any event for empty iterable", () => {
    const map = new ObservableMap<string, string>([["a", "1"]]);
    const listener = new Listener(map);

    listener.expectBatch(0, 0, () => {
      const count = map.deleteAll([]);
      expect(count).to.equal(0);
    });
    expect(map.size).to.equal(1);
  });

  it("deleteAll should not raise event when no keys exist in map", () => {
    const map = new ObservableMap<string, string>([["a", "1"]]);
    const listener = new Listener(map);

    listener.expectBatch(0, 0, () => {
      const count = map.deleteAll(["x", "y"]);
      expect(count).to.equal(0);
    });
    expect(map.size).to.equal(1);
  });

  it("deleteAll should count only actually deleted items", () => {
    const map = new ObservableMap<string, string>([["a", "1"], ["b", "2"]]);
    const listener = new Listener(map);

    listener.expectBatch(0, 1, () => {
      const count = map.deleteAll(["a", "x"]);
      expect(count).to.equal(1);
    });
    expect(map.size).to.equal(1);
    expect(map.has("b")).to.be.true;
  });
});
