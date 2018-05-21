/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, Dictionary, compareNumbers } from "@bentley/bentleyjs-core";
import { ColorDef, ColorIndex } from "@bentley/imodeljs-common";

export class ColorMap {
  private readonly _dict = new Dictionary<number, number>(compareNumbers);
  private _hasAlpha: boolean = false;

  private static get maxIndex(): number { return 0xffff; }
  private static scratchColorDef = new ColorDef();

  public hasColor(color: number): boolean {
    return undefined !== this._dict.get(color);
  }

  public getIndex(color: number): number {
    const found = this._dict.get(color);
    if (undefined !== found)
      return found;

    assert(!this.isFull);

    // The table should never contain a mix of opaque and translucent colors.
    if (this.isEmpty)
      this._hasAlpha = ColorMap.hasAlpha(color);
    else
      assert(ColorMap.hasAlpha(color) === this.hasTransparency);

    const index = this._dict.length;
    this._dict.insert(color, index);
    assert(this._dict.length === index + 1);
    return index;
  }

  private static hasAlpha(color: number) {
    this.scratchColorDef.tbgr = color;
    return 0 !== this.scratchColorDef.getAlpha();
  }

  public get hasTransparency(): boolean { return this._hasAlpha; }
  public get isUniform(): boolean { return 1 === this.length; }

  public get length(): number { return this._dict.length; }
  public get isEmpty(): boolean { return this.length === 0; }
  public get isFull(): boolean { return this.length >= ColorMap.maxIndex; }

  public toColorIndex(index: ColorIndex, indices: Uint16Array): void {
    index.reset();
    if (0 === this.length) {
      assert(false, "empty color map");
      return;
    }

    const { keys, values } = this._dict.extractArrays();
    if (1 === keys.length) {
      index.initUniform(keys[0]);
    } else {
      const colors = new Uint32Array(keys.length);
      for (let i = 0; i < keys.length; i++)
        colors[values[i]] = keys[i];

      index.initNonUniform(colors, indices, this.hasTransparency);
    }
  }
}
