/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { PriorityQueue } from "../core-bentley";

class TestHeap extends PriorityQueue<number> {
  public invertOrder: boolean = false;

  public constructor() {
    super((lhs, rhs) => this._doCompare(lhs, rhs));
  }

  private _doCompare(lhs: number, rhs: number) {
    return (lhs - rhs) * (this.invertOrder ? -1.0 : 1.0);
  }

  public get isSorted(): boolean {
    let isSorted = true;
    for (let i = 0; i < this.length; i++) {
      const left = 2 * (i + 1) - 1;
      if (left < this.length)
        isSorted = isSorted && (this._compare(this._array[i], this._array[left]) <= 0);

      const right = 2 * (i + 1);
      if (right < this.length)
        isSorted = isSorted && (this._compare(this._array[i], this._array[right]) <= 0);
    }

    return isSorted;
  }

  public initRandom(numEntries: number = 100) {
    this.clear();
    for (let i = 0; i < numEntries; i++)
      this.push(Math.random());
  }
}

describe("PriorityQueue", () => {
  it("maintains heap property on push", () => {
    const heap = new TestHeap();
    for (let i = 0; i < 100; i++) {
      heap.push(Math.random());
      expect(heap.isSorted).to.be.true;
    }
  });

  it("maintains heap property on pop", () => {
    const heap = new TestHeap();
    heap.initRandom(100);

    for (let i = 0; i < 100; i++) {
      expect(heap.length).to.equal(100 - i);
      expect(heap.pop()).not.to.be.undefined;
      expect(heap.length).to.equal(100 - i - 1);
      expect(heap.isSorted).to.be.true;
    }
  });

  it("pops in sorted order", () => {
    const heap = new TestHeap();
    heap.initRandom(100);

    let curr = heap.pop();
    expect(curr).not.to.be.undefined;

    while (!heap.isEmpty) {
      const next = heap.pop();
      expect(next).not.to.be.undefined;
      expect(curr!).to.be.at.most(next!); // curr <= next
      curr = next;
    }

    expect(heap.isEmpty).to.be.true;
  });

  it("can be reordered", () => {
    // Populate in ascending order
    const heap = new TestHeap();
    heap.initRandom(100);

    // Invert ordering criterion and reorder.
    heap.invertOrder = true;
    heap.sort();

    // Confirm elements now popped in descending order.
    let curr = heap.pop();
    expect(curr).not.to.be.undefined;

    while (!heap.isEmpty) {
      const next = heap.pop();
      expect(curr!).to.be.at.least(next!); // curr >= next
      curr = next;
    }
  });
});
