/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, IndexMap, compareNumbers } from "@bentley/bentleyjs-core";
import { ColorDef, ColorIndex } from "@bentley/imodeljs-common";

export class ColorMap extends IndexMap<number> {
  private _hasAlpha: boolean = false;

  public constructor() { super(compareNumbers, 0xffff); }

  public hasColor(color: number): boolean { return -1 !== this.indexOf(color); }

  public insert(color: number): number {
    // The table should never contain a mix of opaque and translucent colors.
    if (this.isEmpty)
      this._hasAlpha = ColorMap.hasAlpha(color);
    else
      assert(ColorMap.hasAlpha(color) === this.hasTransparency);

    return super.insert(color);
  }

  public get hasTransparency(): boolean { return this._hasAlpha; }
  public get isUniform(): boolean { return 1 === this.length; }

  public toColorIndex(index: ColorIndex, indices: Uint16Array): void {
    index.reset();
    if (0 === this.length) {
      assert(false, "empty color map");
      return;
    } else if (1 === this.length) {
      index.initUniform(this.array[0].value);
    } else {
      const colors = new Uint32Array(this.length);
      for (const entry of this.array)
        colors[entry.index] = entry.value;

      index.initNonUniform(colors, indices, this.hasTransparency);
    }
  }

  private static scratchColorDef = new ColorDef();
  private static hasAlpha(color: number) {
    this.scratchColorDef.tbgr = color;
    return 0 !== this.scratchColorDef.getAlpha();
  }
}
