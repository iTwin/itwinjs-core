/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { UintArrayBuilder } from "../TypedArrayBuilder";

describe("UintArrayBuilder", () => {
  class Builder extends UintArrayBuilder {
    public get data() {
      return this._data;
    }

    public expect(type: typeof Uint8Array | typeof Uint16Array | typeof Uint32Array, expected: number[]) {
      expect(this.data).instanceof(type);
      const actual = Array.from(this.toTypedArray());
      expect(actual).to.deep.equal(expected);
    }

    public expect8(expected: number[]) {
      this.expect(Uint8Array, expected);
    }

    public expect16(expected: number[]) {
      this.expect(Uint16Array, expected);
    }

    public expect32(expected: number[]) {
      this.expect(Uint32Array, expected);
    }
  }

  it("defaults to Uint8Array initially", () => {
    new Builder().expect8([]);
    new Builder({ initialCapacity: 17 }).expect8([]);
  });

  it("replaces underlying array type to fit maximum values", () => {
    let b = new Builder();
    b.push(254);
    b.push(255);
    b.expect8([254, 255]);

    b.push(256);
    b.expect16([254, 255, 256]);
    b.push(0xffff);
    b.expect16([254, 255, 256, 0xffff]);

    b.push(0x10000);
    b.expect32([254, 255, 256, 0xffff, 0x10000]);

    b = new Builder();
    b.push(1);
    b.expect8([1]);

    b.push(123456789);
    b.expect32([1, 123456789]);

    b = new Builder();
    b.push(1234);
    b.expect16([1234]);
    b.push(123456789);
    b.expect32([1234, 123456789]);

    b = new Builder();
    b.append(new Uint8Array([254, 255]));
    b.expect8([254, 255]);

    b.append(new Uint16Array([256, 0xffff]));
    b.expect16([254, 255, 256, 0xffff]);

    b.append(new Uint32Array([0x10000]));
    b.expect32([254, 255, 256, 0xffff, 0x10000]);

    b = new Builder();
    b.append(new Uint32Array([1, 123456789]));
    b.expect32([1, 123456789]);
  });

  it("retains previous array if underlying type will fit maximum value and capacity is sufficient", () => {
    const b = new Builder({ initialCapacity: 4 });
    const d = b.data;
    b.append(new Uint32Array([0, 1, 254, 255]));
    b.expect8([0, 1, 254, 255]);
    expect(b.data).to.equal(d);
    b.push(127);
    expect(b.data).not.to.equal(d);
  });

  it("uses initialType if specified", () => {
    const b8 = new Builder({ initialType: Uint8Array });
    const b16 = new Builder({ initialType: Uint16Array });
    const b32 = new Builder({ initialType: Uint32Array });

    b8.expect8([]);
    b16.expect16([]);
    b32.expect32([]);

    b8.push(0xffff);
    b8.expect16([0xffff]);
    b16.push(0xffff);
    b16.expect16([0xffff]);
    b32.push(0xffff);
    b32.expect32([0xffff]);

    b8.push(0x10000);
    b16.push(0x10000);
    b32.push(0x10000);
    b8.expect32([0xffff, 0x10000]);
    b16.expect32([0xffff, 0x10000]);
    b32.expect32([0xffff, 0x10000]);
  });
});
