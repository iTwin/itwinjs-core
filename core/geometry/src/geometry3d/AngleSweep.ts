/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { GrowableFloat64Array } from "./GrowableArray";
import { Angle } from "./Angle";
import { BeJSONFunctions, Geometry, AngleSweepProps } from "../Geometry";
/**
 * An AngleSweep is a pair of angles at start and end of an interval.
 *
 * *  For stroking purposes, the "included interval" is all angles numerically reached by theta = start + f*(end-start), where f is between 0 and 1.
 * *  This stroking formula is simple numbers -- 2PI shifts are not involved.
 * *  2PI shifts do become important in the reverse mapping of an angle to a fraction.
 * *  If (start < end) the angle proceeds CCW around the unit circle.
 * *  If (end < start) the angle proceeds CW around the unit circle.
 * *  Angles beyond 360 are fine as endpoints.
 *
 * **  (350,370) covers the same unit angles as (-10,10).
 * **  (370,350) covers the same unit angles as (10,-10).
 */
export class AngleSweep implements BeJSONFunctions {
    private _radians0: number;
    private _radians1: number;
    /** Read-property for degrees at the start of this AngleSweep. */
    public get startDegrees() { return Angle.radiansToDegrees(this._radians0); }
    /** Read-property for degrees at the end of this AngleSweep. */
    public get endDegrees() { return Angle.radiansToDegrees(this._radians1); }
    /** Read-property for signed start-to-end sweep in degrees. */
    public get sweepDegrees() { return Angle.radiansToDegrees(this._radians1 - this._radians0); }
    /** Read-property for degrees at the start of this AngleSweep. */
    public get startRadians() { return this._radians0; }
    /** Read-property for degrees at the end of this AngleSweep. */
    public get endRadians() { return this._radians1; }
    /** Read-property for signed start-to-end sweep in radians. */
    public get sweepRadians() { return this._radians1 - this._radians0; }
    /** Return the (strongly typed) start angle */
    public get startAngle() { return Angle.createRadians(this._radians0); }
    /** Return the (strongly typed) end angle */
    public get endAngle() { return Angle.createRadians(this._radians1); }
    /** (private) constructor with start and end angles in radians.
     *  * Use explicitly named static methods to clarify intent and units of inputs:
     *
     * * createStartEndRadians (startRadians:number, endRadians:number)
     * * createStartEndDegrees (startDegrees:number, endDegrees:number)
     * * createStartEnd (startAngle:Angle, endAngle:Angle)
     * * createStartSweepRadians (startRadians:number, sweepRadians:number)
     * * createStartSweepDegrees (startDegrees:number, sweepDegrees:number)
     * * createStartSweep (startAngle:Angle, sweepAngle:Angle)
     */
    private constructor(startRadians: number = 0, endRadians: number = 0) { this._radians0 = startRadians; this._radians1 = endRadians; }
    /** create an AngleSweep from start and end angles given in radians. */
    public static createStartEndRadians(startRadians: number = 0, endRadians: number = 2.0 * Math.PI, result?: AngleSweep): AngleSweep {
        result = result ? result : new AngleSweep();
        result.setStartEndRadians(startRadians, endRadians);
        return result;
    }
    /** Return the angle obtained by subtracting radians from this angle. */
    public cloneMinusRadians(radians: number): AngleSweep { return new AngleSweep(this._radians0 - radians, this._radians1 - radians); }
    /** create an AngleSweep from start and end angles given in degrees. */
    public static createStartEndDegrees(startDegrees: number = 0, endDegrees: number = 360, result?: AngleSweep): AngleSweep {
        return AngleSweep.createStartEndRadians(Angle.degreesToRadians(startDegrees), Angle.degreesToRadians(endDegrees), result);
    }
    /** create an angle sweep from strongly typed start and end angles */
    public static createStartEnd(startAngle: Angle, endAngle: Angle, result?: AngleSweep): AngleSweep {
        result = result ? result : new AngleSweep();
        result.setStartEndRadians(startAngle.radians, endAngle.radians);
        return result;
    }
    /** Create an angle sweep with limits given as (strongly typed) angles for start and sweep */
    public static createStartSweep(startAngle: Angle, sweepAngle: Angle, result?: AngleSweep): AngleSweep {
        return AngleSweep.createStartSweepRadians(startAngle.radians, sweepAngle.radians, result);
    }
    /** @returns Return a sweep with limits interpolated between this and other. */
    public interpolate(fraction: number, other: AngleSweep): AngleSweep {
        return new AngleSweep(Geometry.interpolate(this._radians0, fraction, other._radians0), Geometry.interpolate(this._radians1, fraction, other._radians1));
    }
    /** create an AngleSweep from start and end angles given in radians. */
    public static createStartSweepRadians(startRadians: number = 0, sweepRadians: number = Math.PI, result?: AngleSweep): AngleSweep {
        result = result ? result : new AngleSweep();
        result.setStartEndRadians(startRadians, startRadians + sweepRadians);
        return result;
    }
    /** create an AngleSweep from start and sweep given in degrees.  */
    public static createStartSweepDegrees(startDegrees: number = 0, sweepDegrees: number = 360, result?: AngleSweep): AngleSweep {
        return AngleSweep.createStartEndRadians(Angle.degreesToRadians(startDegrees), Angle.degreesToRadians(startDegrees + sweepDegrees), result);
    }
    /** directly set the start and end angles in radians */
    public setStartEndRadians(startRadians: number = 0, endRadians: number = 2.0 * Math.PI) {
        const delta = endRadians - startRadians;
        if (Angle.isFullCircleRadians(delta)) {
            endRadians = startRadians + (delta > 0 ? 2.0 : -2.0) * Math.PI;
        }
        this._radians0 = startRadians;
        this._radians1 = endRadians;
    }
    /** directly set the start and end angles in degrees */
    public setStartEndDegrees(startDegrees: number = 0, endDegrees: number = 360.0) {
        this.setStartEndRadians(Angle.degreesToRadians(startDegrees), Angle.degreesToRadians(endDegrees));
    }
    /** copy from other AngleSweep. */
    public setFrom(other: AngleSweep) { this._radians0 = other._radians0; this._radians1 = other._radians1; }
    /** create a full circle sweep (CCW). startRadians defaults to 0 */
    public static create360(startRadians?: number): AngleSweep {
        startRadians = startRadians ? startRadians : 0.0;
        return new AngleSweep(startRadians, startRadians + 2.0 * Math.PI);
    }
    /** create a sweep from the south pole to the north pole. */
    public static createFullLatitude() { return AngleSweep.createStartEndRadians(-0.5 * Math.PI, 0.5 * Math.PI); }
    /** Reverse the start and end angle in place. */
    public reverseInPlace() { const a = this._radians0; this._radians0 = this._radians1; this._radians1 = a; }
    /** Restrict start and end angles into the range (-90,+90) in degrees. */
    public capLatitudeInPlace() {
        const limit = 0.5 * Math.PI;
        this._radians0 = Geometry.clampToStartEnd(this._radians0, -limit, limit);
        this._radians1 = Geometry.clampToStartEnd(this._radians1, -limit, limit);
    }
    /** Ask if the sweep is counterclockwise, i.e. positive sweep */
    public get isCCW(): boolean { return this._radians1 >= this._radians0; }
    /** Ask if the sweep is a full circle. */
    public get isFullCircle(): boolean { return Angle.isFullCircleRadians(this.sweepRadians); }
    /** Ask if the sweep is a full sweep from south pole to north pole. */
    public get isFullLatitudeSweep(): boolean {
        const a = Math.PI * 0.5;
        return Angle.isAlmostEqualRadiansNoPeriodShift(this._radians0, -a)
            && Angle.isAlmostEqualRadiansNoPeriodShift(this._radians1, a);
    }
    /** return a clone of this sweep. */
    public clone(): AngleSweep { return new AngleSweep(this._radians0, this._radians1); }
    /** Convert fractional position in the sweep to radians. */
    public fractionToRadians(fraction: number) {
        return fraction < 0.5 ?
            this._radians0 + fraction * (this._radians1 - this._radians0)
            : this._radians1 + (fraction - 1.0) * (this._radians1 - this._radians0);
    }
    /** Convert fractional position in the sweep to strongly typed Angle object. */
    public fractionToAngle(fraction: number) {
        return Angle.createRadians(this.fractionToRadians(fraction));
    }
    /** return 2PI divided by the sweep radians (i.e. 360 degrees divided by sweep angle).
     * This is the number of fractional intervals required to cover a whole circle.
     */
    public fractionPeriod(): number {
        return Geometry.safeDivideFraction(Math.PI * 2.0, Math.abs(this._radians1 - this._radians0), 1.0);
    }
    /** return the fractional ized position of the angle,
     * computed without consideration of 2PI period.
     * That is, an angle that is numerically much beyond than the end angle
     * will produce a large fraction and an angle much beyond the start angle
     * will produce a large negative fraction.
     *
     */
    public angleToUnboundedFraction(theta: Angle): number {
        return Geometry.safeDivideFraction(theta.radians - this._radians0, this._radians1 - this._radians0, 1.0);
    }
    /** map an angle to a fractional coordinate which is:
     *
     * *  the start angle is at fraction 0
     * *  the end angle is at fraction 1
     * *  interior angles are between 0 and 1
     * *  all exterior angles are at fractions greater than 1
     * *  the periodic jump is at full wraparound to the start angle
     */
    public angleToPositivePeriodicFraction(theta: Angle): number { return this.radiansToPositivePeriodicFraction(theta.radians); }
    /**
     * Convert each value in an array from radians to fraction.
     * @param data array that is input as radians, output as fractions
     */
    public radiansArraytoPositivePeriodicFractions(data: GrowableFloat64Array) {
        const n = data.length;
        for (let i = 0; i < n; i++) {
            data.reassign(i, this.radiansToPositivePeriodicFraction(data.at(i)));
        }
    }
    public radiansToPositivePeriodicFraction(radians: number): number {
        if (Angle.isAlmostEqualRadiansAllowPeriodShift(radians, this._radians0))
            return 0.0;
        if (Angle.isAlmostEqualRadiansAllowPeriodShift(radians, this._radians1))
            return 1.0;
        const sweep = this._radians1 - this._radians0;
        const delta = radians - this._radians0;
        if (sweep > 0) {
            const delta1 = Angle.adjustRadians0To2Pi(delta);
            const fraction1 = Geometry.safeDivideFraction(delta1, sweep, 0.0);
            return fraction1;
        }
        const delta2 = Angle.adjustRadians0To2Pi(-delta);
        const fraction2 = Geometry.safeDivideFraction(delta2, -sweep, 0.0);
        return fraction2;
    }
    /** map an angle to a fractional coordinate which is:
     *
     * *  the start angle is at fraction 0
     * *  the end angle is at fraction 1
     * *  interior angles are between 0 and 1
     * *  small negative for angles just "before" the start angle
     * *  more than one for angles just "after" the end angle
     * *  the periodic jump is at the middle of the "outside" interval
     */
    public angleToSignedPeriodicFraction(theta: Angle): number {
        return this.radiansToSignedPeriodicFraction(theta.radians);
    }
    public radiansToSignedPeriodicFraction(radians: number): number {
        if (Angle.isAlmostEqualRadiansAllowPeriodShift(radians, this._radians0))
            return 0.0;
        if (Angle.isAlmostEqualRadiansAllowPeriodShift(radians, this._radians1))
            return 1.0;
        const sweep = this._radians1 - this._radians0;
        // measure from middle of interval ...
        const delta = radians - this._radians0 - 0.5 * sweep;
        if (sweep > 0) {
            const delta1 = Angle.adjustRadiansMinusPiPlusPi(delta);
            const fraction1 = 0.5 + Geometry.safeDivideFraction(delta1, sweep, 0.0);
            return fraction1;
        }
        const delta2 = Angle.adjustRadiansMinusPiPlusPi(-delta);
        const fraction = 0.5 + Geometry.safeDivideFraction(delta2, -sweep, 0.0);
        return fraction;
    }
    /** test if an angle is within the sweep */
    public isAngleInSweep(angle: Angle): boolean { return this.isRadiansInSweep(angle.radians); }
    /** test if radians are within sweep  */
    public isRadiansInSweep(radians: number): boolean {
        // quick out for simple inside ...
        const delta0 = radians - this._radians0;
        const delta1 = radians - this._radians1;
        if (delta0 * delta1 <= 0.0)
            return true;
        return this.radiansToPositivePeriodicFraction(radians) <= 1.0;
    }
    /** set this AngleSweep from various sources:
     *
     * * if json is undefined, a full-circle sweep is returned.
     * * If json is an AngleSweep object it is is cloned
     * * If json is an array of 2 numbers, those numbers are start and end angles in degrees.
     * * If `json.degrees` is an array of 2 numbers, those numbers are start and end angles in degrees.
     * * If `json.radians` is an array of 2 numbers, those numbers are start and end angles in radians.
     */
    public setFromJSON(json?: any) {
        if (!json)
            this.setStartEndRadians(); // default full circle
        else if (json instanceof AngleSweep)
            this.setFrom(json as AngleSweep);
        else if (Geometry.isNumberArray(json.degrees, 2))
            this.setStartEndDegrees(json.degrees[0], json.degrees[1]);
        else if (Geometry.isNumberArray(json.radians, 2))
            this.setStartEndRadians(json.radians[0], json.radians[1]);
        else if (Geometry.isNumberArray(json, 2))
            this.setStartEndDegrees(json[0], json[1]);
    }
    /** create an AngleSweep from a json object. */
    public static fromJSON(json?: AngleSweepProps) {
        const result = AngleSweep.create360();
        result.setFromJSON(json);
        return result;
    }
    /**
     * Convert an AngleSweep to a JSON object.
     * @return {*} {degrees: [startAngleInDegrees, endAngleInDegrees}
     */
    public toJSON(): any {
        // return { degrees: [this.startDegrees, this.endDegrees] };
        return [this.startDegrees, this.endDegrees];
    }
    /** test if start and end angles match, with explicit name to clarify that there is no test for 360-degree shifts. */
    public isAlmostEqualAllowPeriodShift(other: AngleSweep): boolean {
        return Angle.isAlmostEqualRadiansAllowPeriodShift(this._radians0, other._radians0)
            && Angle.isAlmostEqualRadiansNoPeriodShift(this._radians1 - this._radians0, other._radians1 - other._radians0);
    }
    /** test if start and end angles match, explicit name to clarify that 360-degree shifts are allowed. */
    public isAlmostEqualNoPeriodShift(other: AngleSweep): boolean {
        return Angle.isAlmostEqualRadiansNoPeriodShift(this._radians0, other._radians0)
            && Angle.isAlmostEqualRadiansNoPeriodShift(this._radians1 - this._radians0, other._radians1 - other._radians0);
    }
    /** test if start and end angles match with radians tolerance.
     * * This is equivalent to isAlmostEqualNoPeriodShift.
     * * it is present for consistency with other classes
     * * It is recommended that all callers use one of he longer names to be clear of their intentions:
     * * * isAlmostEqualAllowPeriodShift
     * * * isAlmostEqualRadiansNoPeriodShift
     */
    public isAlmostEqual(other: AngleSweep): boolean { return this.isAlmostEqualNoPeriodShift(other); }
}
