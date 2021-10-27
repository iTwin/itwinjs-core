/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { ALong } from "./ALong";

/**
 * Class Numbers defines the common numerical tools.
 */
/** @internal */
export class Numbers {
    /** The static byte buffer for number format conversions */
    private static readonly BUFFER1: ArrayBuffer = new ArrayBuffer(8);
    private static readonly I8_BUFFER1: Int8Array = new Int8Array(Numbers.BUFFER1);
    private static readonly I32_BUFFER1: Int32Array = new Int32Array(Numbers.BUFFER1);
    private static readonly F32_BUFFER1: Float32Array = new Float32Array(Numbers.BUFFER1);
    private static readonly F64_BUFFER1: Float64Array = new Float64Array(Numbers.BUFFER1);

    private constructor() {
    }

    public static sqrt(value: float64): float64 {
        return Math.sqrt(value);
    }

    public static floor(value: float64): float64 {
        return Math.floor(value);
    }

    public static intFloor(value: float64): int32 {
        return Math.floor(value);
    }

    public static divInt(value1: int32, value2: int32): int32 {
        return Math.trunc(value1 / value2);
    }

    public static intBitsToFloat(value: int32): float32 {
        Numbers.I32_BUFFER1[0] = value;
        return Numbers.F32_BUFFER1[0];
    }

    public static floatToIntBits(value: float32): int32 {
        Numbers.F32_BUFFER1[0] = value;
        return Numbers.I32_BUFFER1[0];
    }

    public static longBitsToDouble(value: ALong): float64 {
        Numbers.I32_BUFFER1[0] = value.getLow();
        Numbers.I32_BUFFER1[1] = value.getHigh();
        return Numbers.F64_BUFFER1[0];
    }

    public static doubleToLongBits(value: float64): ALong {
        Numbers.F64_BUFFER1[0] = value;
        return ALong.fromHighLow(Numbers.I32_BUFFER1[1], Numbers.I32_BUFFER1[0]);
    }

    public static intToDouble(value: int32): float64 {
        return value;
    }

    public static doubleToInt(value: float64): int32 {
        return Math.floor(value);
    }

    public static getInteger(value: string, defaultValue: int32): int32 {
        if (value == undefined) return defaultValue;
        if (value == null) return defaultValue;
        if (value.length == 0) return defaultValue;
        let parsed: int32 = parseInt(value);
        return (Number.isNaN(parsed)) ? defaultValue : parsed;
    }

    public static getDouble(value: string, defaultValue: float64): float64 {
        if (value == undefined) return defaultValue;
        if (value == null) return defaultValue;
        if (value.length == 0) return defaultValue;
        let parsed: float64 = parseFloat(value);
        return (Number.isNaN(parsed)) ? defaultValue : parsed;
    }

    public static rgbToString(color: int32): string {
        let r: int32 = (color >> 16) & 0xFF;
        let g: int32 = (color >> 8) & 0xFF;
        let b: int32 = (color >> 0) & 0xFF;
        return "" + r + "." + g + "." + b;
    }
}
