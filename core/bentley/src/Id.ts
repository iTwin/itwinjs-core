/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
export type Id64Props = Id64 | string;
export type GuidProps = Guid | string;
export type Id64Set = Set<string>;
export type Id64Array = string[];
export type Id64Arg = Id64[] | Id64 | Id64Set | Id64Array | string;

/** A 64 bit id, stored as a hex string. If invalid, value will be "0" */
export class Id64 {
  public readonly value: string;
  private static toHex(str: string): number { const v = parseInt(str, 16); return Number.isNaN(v) ? 0 : v; }
  protected toJSON(): string { return this.value; }

  /** get the "low" part of this Id64. This is the "local id", and is the lower 40 bits of the 64 bit value. */
  public getLow(): number {
    if (!this.isValid())
      return 0;

    let start = 2;
    const len = this.value.length;
    if (len > 12)
      start = (len - 10);

    return Id64.toHex(this.value.slice(start));
  }

  /** get the "high" part of this Id64. This is the "briefcase id", and is the high 24 bits of the 64 bit value. */
  public getHigh(): number {
    if (!this.isValid())
      return 0;

    let start = 2;
    const len = this.value.length;
    if (len <= 12)
      return 0;

    start = (len - 10);
    return Id64.toHex(this.value.slice(2, start));
  }

  /**
   * constructor for Id64
   * @param prop either a string with a hex number, another Id64, or an array of two numbers with [low,high]. Otherwise it will be invalid.
   */
  constructor(prop?: Id64Props | number[]) {
    if (!prop) {
      this.value = "0";
      return;
    }

    let low = 0;
    let high = 0;

    if (typeof prop === "string") {
      prop = prop.toLowerCase().trim();
      if (prop[0] !== "0" || !(prop[1] === "x")) {
        this.value = "0";
        return;
      }

      let start = 2;
      const len = prop.length;
      if (len > 12) {
        start = (len - 10);
        high = Id64.toHex(prop.slice(2, start));
      }

      low = Id64.toHex(prop.slice(start));
    } else if (prop instanceof Id64) {
      this.value = prop.value;
      return;
    }

    if (Array.isArray(prop) && prop.length >= 2) {
      low = prop[0] | 0;
      high = prop[1] | 0;
    }

    if (low === 0) { // it is illegal to have a low value of 0
      this.value = "0";
      return;
    }

    const lowStr = low.toString(16).toLowerCase();
    this.value = "0x" + ((high === 0) ? lowStr : (high.toString(16).toLowerCase() + ("0000000000" + lowStr).substr(-10)));
  }

  /** convert this Id to a string */
  public toString(): string { return this.value; }

  /** Determine whether this Id is valid */
  public isValid(): boolean { return this.value !== "0"; }

  /** Test whether two Ids are the same */
  public equals(other: Id64): boolean { return this.value === other.value; }
  public static areEqual(a?: Id64, b?: Id64): boolean { return (a === b) || (a != null && b != null && a.equals(b)); }

  /** create an Id64 from a json object. If val is already an Id64, just return it since Id64s are immutable. */
  public static fromJSON(val?: Id64Props): Id64 { return val instanceof Id64 ? val : new Id64(val); }

  public static toIdSet(arg: Id64Arg): Id64Set {
    if (arg instanceof Set)
      return arg;
    const ids = new Set<string>();
    if (typeof arg === "string")
      ids.add(arg);
    else if (arg instanceof Id64)
      ids.add(arg.value);
    else if (Array.isArray(arg)) {
      if (arg.length > 0) {
        (typeof arg[0] === "string") ? (arg as string[]).forEach((id) => ids.add(id)) : (arg as Id64[]).forEach((id) => ids.add(id.value));
      }
    }
    return ids;
  }
}

/** a string in the "8-4-4-4-12" pattern. Does not enforce that the Guid is a valid v4 format uuid. */
export class Guid {
  public readonly value: string;
  private static uuidPattern = new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");
  private static hexChars = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
  private static v4VariantChars = ["8", "9", "a", "b"];

  public constructor(input?: Guid | string | boolean) {
    if (typeof input === "string") { this.value = input.toLowerCase(); if (Guid.isGuid(this.value)) return; }
    if (input instanceof Guid) { this.value = input.value; return; }
    if (typeof input === "boolean") { if (input) { this.value = Guid.createValue(); return; } }
    this.value = "";
  }
  public equals(other: Guid): boolean { return this.value === other.value; }
  public isValid(): boolean { return this.value !== ""; }
  public toString(): string { return this.value; }
  public toJSON(): string { return this.value; }
  public static fromJSON(val?: GuidProps): Guid | undefined { return val ? new Guid(val) : undefined; }

  /** determine whether the input string is "guid-like". That is, it follows the 8-4-4-4-12 pattern. This does not enforce
   *  that the string is actually in valid UUID format.
   */
  public static isGuid(value: string) { return Guid.uuidPattern.test(value); }

  /** determine whether the input string is a valid V4 Guid string */
  public static isV4Guid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value); }

  private static randomCharFrom(array: string[]): string {
    return array[Math.floor(array.length * Math.random())];
  }

  /** Create a new V4 Guid value */
  public static createValue(): string {
    return [
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      "-",
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      "-",
      "4",
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      "-",
      Guid.randomCharFrom(Guid.v4VariantChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      "-",
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
      Guid.randomCharFrom(Guid.hexChars),
    ].join("");
  }
}
