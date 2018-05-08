/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { ColorDef, ColorIndex } from "@bentley/imodeljs-common";

export class ColorMap {
  // ###TODO: Use a sorted array
  private readonly _list: number[] = [];
  private _hasAlpha: boolean = false;

  private static get maxIndex(): number { return 0xffff; }
  private static scratchColorDef = new ColorDef();

  public getIndex(color: number): number {
    for (let i = 0; i < this.length; i++) {
      if (this._list[i] === color) {
        return i;
      }
    }

    assert(!this.isFull);

    // The table should never contain a mix of opaque and translucent colors.
    if (this.isEmpty) {
      this._hasAlpha = ColorMap.hasAlpha(color);
    } else {
      assert(ColorMap.hasAlpha(color) === this.hasTransparency);
    }

    this._list.push(color);
    return this._list.length - 1;
  }

  private static hasAlpha(color: number) {
    this.scratchColorDef.tbgr = color;
    return 0 !== this.scratchColorDef.getAlpha();
  }

  public get hasTransparency(): boolean { return this._hasAlpha; }
  public get isUniform(): boolean { return 1 === this.length; }

  public get length(): number { return this._list.length; }
  public get isEmpty(): boolean { return this.length === 0; }
  public get isFull(): boolean { return this.length >= ColorMap.maxIndex; }

  public toColorIndex(index: ColorIndex, indices: Uint16Array): void {
    index.reset();
    switch (this.length) {
      case 0: {
        assert(false, "empty color map");
        break;
      }
      case 1: {
        index.initUniform(this._list[0]);
        break;
      }
      default: {
        assert(0 !== indices.length);
        const colors = Uint32Array.from(this._list);
        index.initNonUniform(colors, indices, this.hasTransparency);
        break;
      }
    }
  }
}
