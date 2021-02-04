/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const expressionRgx = /^(([A-Z]\w*:)?([A-Z]\w*|\[([A-Z]\w*:)?[A-Z]\w*\])(\(-?\d+\))?(\*(?!$)|$))+$/i;
const tokenRgx = /(?:(\[)?((?:[A-Z]\w*:)?[A-Z]\w*)\]?)(?:\((-?\d+)\))?/i;
const sp = "*";

enum Tokens {
  Bracket = 1,
  Word = 2,
  Exponent = 3,
}

export type Definition = Array<{
  name: string;
  exponent: number;
  constant: boolean;
}>;

export function parseDefinition(definition: string): UnitMap {
  const tokenizedDefinition: Definition = [];
  const umap = new UnitMap();

  if (expressionRgx.test(definition)) {
    for (const unit of definition.split(sp)) {
      const tokens = unit.split(tokenRgx);
      const name = tokens[Tokens.Word];
      const exponent = tokens[Tokens.Exponent]
        ? Number(tokens[Tokens.Exponent])
        : 1;
      const constant = tokens[Tokens.Bracket] !== undefined;
      tokenizedDefinition.push({ name, exponent, constant });
    }

    tokenizedDefinition.forEach((definition) => {
      let unitDefinition = new UnitDef(definition.name, definition.exponent);
      umap.upsert(unitDefinition);
    });
    return umap;
  } else throw new Error("Invalid definition expression.");
}

export class UnitDef {
  constructor(public readonly name: string, public readonly exponent: number) {}

  multiply(power: number): UnitDef {
    return new UnitDef(this.name, this.exponent + power);
  }

  raise(power: number): UnitDef {
    return new UnitDef(this.name, this.exponent * power);
  }
}

export class UnitMap {
  unitMap: Map<string, UnitDef>;

  constructor() {
    this.unitMap = new Map<string, UnitDef>();
  }

  upsert(def: UnitDef): void {
    const existing = this.unitMap.get(def.name);
    if (!existing) {
      this.unitMap.set(def.name, def);
      return;
    }

    const raised = existing.multiply(def.exponent);
    this.unitMap.set(def.name, raised);
  }

  raise(power: number): void {
    this.unitMap.forEach((v, k) => {
      this.unitMap.set(k, v.raise(power));
    });
  }

  forEach(op: (value: UnitDef) => void): void {
    this.unitMap.forEach(op);
  }

  map<T>(op: (value: UnitDef) => T): T[] {
    const results: T[] = [];
    this.forEach((def) => {
      const result = op(def);
      results.push(result);
    });
    return results;
  }

  merge(rhs: UnitMap): void {
    rhs.forEach((v) => {
      this.upsert(v);
    });
  }

  has(unitName: string): boolean {
    return this.unitMap.has(unitName);
  }

  get(unitName: string): UnitDef | undefined {
    return this.unitMap.get(unitName);
  }

  get length(): number {
    return this.unitMap.size;
  }
}
