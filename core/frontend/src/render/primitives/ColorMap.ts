/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { ColorDef, ColorIndex } from "@bentley/imodeljs-common";

export class ColorMap {
  public map: Map<number, number> = new Map<number, number>();
  public hasAlpha: boolean = false;

  protected static getMaxIndex(): number { return 0xffff; }

  public getIndex(color: number): number {
    assert(!this.isFull());
    assert(this.empty() || (0 !== new ColorDef(color).getAlpha()) === this.hasAlpha);

    const val = this.map.get(color);
    if (val !== undefined) {
      return val;
    } else if (this.isFull()) {
      assert(false);
      return 0;
    }

    // The table should never contain a mix of opaque and translucent colors
    if (this.empty()) {
      this.hasAlpha = (0 !== new ColorDef(color).getAlpha());
    }

    const index = this.getNumIndices();
    this.map.set(color, index);
    return index;
  }

  public hasTransparency(): boolean { return this.hasAlpha; }
  public isUniform(): boolean { return 1 === this.size(); }

  public isFull(): boolean { return this.map.size >= ColorMap.getMaxIndex(); }
  public getNumIndices(): number { return this.map.size; }

  public entries(): IterableIterator<[number, number]> { return this.map.entries(); }
  public size(): number { return this.map.size; }
  public empty(): boolean { return this.map.size === 0; }
  public get(key: number): number | undefined { return this.map.get(key); }

  public toColorIndex(index: ColorIndex, colors: Uint32Array, indices: Uint16Array): void {
    index.reset();
    if (this.empty()) {
      assert(false, "empty color map");
    } else if (this.isUniform()) {
      index.setUniform(this.map.keys().next().value);
    } else {
      assert(0 !== indices.length);

      colors = new Uint32Array(this.size());
      this.map.forEach((item, key) => {
        colors[item] = key;
      });

      index.setNonUniform(this.getNumIndices(), colors, indices, this.hasAlpha);
    }
  }
}
