/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

import { ClipShape, ClipPlaneContainment, ClipMask } from "./ClipPrimitives";
import { Point3d, Segment1d } from "../PointVector";
import { Range3d } from "../Range";
import { Transform } from "../Transform";

import { Geometry } from "../Geometry";
import { Matrix4d } from "./Geometry4d";
import { LineSegment3d } from "../curve/LineSegment3d";

/** Class holding an array structure of shapes defined by clip plane sets */
export class ClipVector {
    private _clips: ClipShape[];
    public boundingRange: Range3d = Range3d.createNull();

    /** Returns a reference to the array of ClipShapes. */
    public get clips() { return this._clips; }

    private constructor(clips?: ClipShape[]) {
        this._clips = clips ? clips : [];
    }

    /** Returns true if this ClipVector contains a ClipShape. */
    public isValid(): boolean { return this._clips.length > 0; }

    /** Create a ClipVector with an empty set of ClipShapes. */
    public static createEmpty(result?: ClipVector): ClipVector {
        if (result) {
            result._clips.length = 0;
            return result;
        }
        return new ClipVector();
    }

    /** Create a ClipVector from an array of ClipShapes */
    public static createClipShapeRefs(clips: ClipShape[], result?: ClipVector): ClipVector {
        if (result) {
            result._clips = clips;
            return result;
        }
        return new ClipVector(clips);
    }

    /** Create a ClipVector from an array of ClipShapes, each one becoming a deep copy. */
    public static createClipShapeClones(clips: ClipShape[], result?: ClipVector): ClipVector {
        const clipClones: ClipShape[] = [];
        for (const clip of clips)
            clipClones.push(clip.clone());
        return ClipVector.createClipShapeRefs(clipClones, result);
    }

    /** Create a deep copy of another ClipVector */
    public static createFrom(donor: ClipVector, result?: ClipVector): ClipVector {
        const retVal = result ? result : new ClipVector();
        retVal._clips.length = 0;
        for (const clip of donor._clips) {
            retVal._clips.push(clip.clone());
        }
        retVal.boundingRange.setFrom(donor.boundingRange);
        return retVal;
    }

    /** Parse this ClipVector into a JSON object. */
    public toJSON(): any {
        if (!this.isValid())
            return [];

        const val: any = [];
        for (const clipShape of this.clips)
            val.push(clipShape.toJSON());

        return val;
    }

    /** Parse a JSON object into a new ClipVector. */
    public static fromJSON(json: any, result?: ClipVector): ClipVector {
        result = result ? result : new ClipVector();
        result.clear();

        try {
            for (const clip of json)
                result.clips.push(ClipShape.fromJSON(clip));
        } catch (e) {
            result.clear();
        }

        return result;
    }

    /** Returns a deep copy of this ClipVector (optionally stores it in the result param rather than create using new()) */
    public clone(result?: ClipVector): ClipVector {
        return ClipVector.createFrom(this, result);
    }

    /** Empties out the array of ClipShapes. */
    public clear() {
        this._clips.length = 0;
    }

    /** Append a deep copy of the given ClipShape to this ClipVector. */
    public appendClone(clip: ClipShape) {
        this._clips.push(clip.clone());
    }

    /** Append a reference of the given ClipShape to this ClipVector. */
    public appendReference(clip: ClipShape) {
        this._clips.push(clip);
    }

    /** Create a new ClipShape from the given parameters, and if successful, append it to this ClipVector. */
    public appendShape(shape: Point3d[], zLow?: number, zHigh?: number,
        transform?: Transform, isMask: boolean = false, invisible: boolean = false) {
        const clip = ClipShape.createShape(shape, zLow, zHigh, transform, isMask, invisible);
        if (clip)
            this._clips.push(clip);
    }

    /** Returns the three-dimensional range that this ClipVector spans, which may be null. */
    public getRange(transform?: Transform, result?: Range3d): Range3d | undefined {
        const range = Range3d.createNull(result);

        for (const shape of this._clips) {
            const thisRange = shape.getRange(false, transform);
            if (thisRange !== undefined) {
                if (range.isNull())
                    range.setFrom(thisRange);
                else
                    range.intersect(thisRange, range);
            }
        }
        if (!this.boundingRange.isNull())
            range.intersect(this.boundingRange, range);

        return range;
    }

    /** Returns true if the given point lies inside all of this ClipVector's ClipShapes (by rule of intersection). */
    public pointInside(point: Point3d, onTolerance: number = Geometry.smallMetricDistanceSquared): boolean {
        if (!this.boundingRange.isNull() && !this.boundingRange.containsPoint(point))
            return false;

        for (const clip of this._clips)
            if (!clip.pointInside(point, onTolerance))
                return false;
        return true;
    }

    /** Transforms this ClipVector to a new coordinate-system. Returns true if successful. */
    public transformInPlace(transform: Transform): boolean {
        for (const clip of this._clips)
            if (clip.transformInPlace(transform) === false)
                return false;

        if (!this.boundingRange.isNull())
            transform.multiplyRange(this.boundingRange, this.boundingRange);

        return true;
    }

    /**
     * A simple way of packaging this ClipVector's ClipShape points into a multidimensional array, while also
     * taking into account each ClipShape's individual transforms.
     *
     * Information out:
     *  - All of the loop points are stored in the multidimensional Point3d array given (will return unchanged upon failure)
     *  - If given a transform, will be set from the transformFromClip of the first ClipShape
     *  - The ClipMask of the final ClipShape is stored in the returned array at index 0
     *  - The last valid zLow found is stored in the returned array at index 1
     *  - The last valid zHigh found is stored in the returned array at index 2
     */
    public extractBoundaryLoops(loopPoints: Point3d[][], transform?: Transform): number[] {
        let clipM = ClipMask.None;
        let zBack = -Number.MAX_VALUE;
        let zFront = Number.MAX_VALUE;
        const retVal: number[] = [];
        let nLoops = 0;

        if (this._clips.length === 0)
            return retVal;

        const deltaTrans = Transform.createIdentity();
        for (const clip of this._clips) {

            if (clip !== this._clips[0]) {      // Is not the first iteration
                let fwdTrans = Transform.createIdentity();
                let invTrans = Transform.createIdentity();

                if (this._clips[0].transformValid && clip.transformValid) {
                    fwdTrans = clip.transformFromClip!.clone();
                    invTrans = this._clips[0].transformToClip!.clone();
                }
                deltaTrans.setFrom(invTrans.multiplyTransformTransform(fwdTrans));
            }

            loopPoints[nLoops] = [];

            if (clip.polygon !== undefined) {
                clipM = ClipMask.XAndY;

                if (clip.zHighValid) {
                    clipM = clipM | ClipMask.ZHigh;
                    zFront = clip.zHigh!;
                }
                if (clip.zLowValid) {
                    clipM = clipM | ClipMask.ZLow;
                    zBack = clip.zLow!;
                }

                for (const point of clip.polygon)
                    loopPoints[nLoops].push(point.clone());
                deltaTrans.multiplyPoint3dArray(loopPoints[nLoops], loopPoints[nLoops]);
                nLoops++;
            }
        }

        retVal.push(clipM);
        retVal.push(zBack);
        retVal.push(zFront);

        if (transform)
            transform.setFrom(this._clips[0].transformFromClip!);

        return retVal;
    }

    /** Sets this ClipVector and all of its members to the visibility specified. */
    public setInvisible(invisible: boolean) {
        for (const clip of this._clips)
            clip.setInvisible(invisible);
    }

    /** For every clip, parse the member point array into the member clip plane object (only for clipPlanes member, not the mask) */
    public parseClipPlanes() {
        for (const clip of this._clips)
            clip.fetchClipPlanesRef();
    }

    /** Returns true if able to successfully multiply all member ClipShape planes by the matrix given. */
    public multiplyPlanesTimesMatrix(matrix: Matrix4d): boolean {
        let numErrors = 0;
        for (const clip of this._clips)
            if (clip.multiplyPlanesTimesMatrix(matrix) === false)
                numErrors++;
        return numErrors === 0 ? true : false;
    }

    /**
     * Determines whether the given points fall inside or outside this set of ClipShapes. If any set is defined by masking planes,
     * checks the mask planes only, provided that ignoreMasks is false. Otherwise, checks the _clipplanes member.
     */
    public classifyPointContainment(points: Point3d[], ignoreMasks: boolean = false): ClipPlaneContainment {
        let currentContainment = ClipPlaneContainment.Ambiguous;

        for (const primitive of this._clips) {
            const thisContainment = primitive.classifyPointContainment(points, ignoreMasks);

            if (ClipPlaneContainment.Ambiguous === thisContainment)
                return ClipPlaneContainment.Ambiguous;

            if (ClipPlaneContainment.Ambiguous === currentContainment)
                currentContainment = thisContainment;
            else if (currentContainment !== thisContainment)
                return ClipPlaneContainment.Ambiguous;
        }
        return currentContainment;
    }

    /**
     * Determines whether a 3D range lies inside or outside this set of ClipShapes. If any set is defined by masking planes,
     * checks the mask planes only, provided that ignoreMasks is false. Otherwise, checks the _clipplanes member.
     */
    public classifyRangeContainment(range: Range3d, ignoreMasks: boolean): ClipPlaneContainment {
        const corners: Point3d[] = range.corners();
        return this.classifyPointContainment(corners, ignoreMasks);
    }

    /**
     * For an array of points (making up a LineString), tests whether the segment between each point lies inside the ClipVector.
     * If true, returns true immediately.
     */
    public isAnyLineStringPointInside(points: Point3d[]): boolean {
        for (const clip of this._clips) {
            const clipPlaneSet = clip.fetchClipPlanesRef();
            for (let i = 0; i + 1 < points.length; i++) {
                const segment = LineSegment3d.create(points[i], points[i + 1]);
                if (clipPlaneSet.isAnyPointInOrOnFromSegment(segment))
                    return true;
            }
        }
        return false;
    }

    /** Note: Line segments are used to represent 1 dimensional intervals here, rather than segments. */
    public sumSizes(intervals: Segment1d[], begin: number, end: number): number {
        let s = 0.0;
        for (let i = begin; i < end; i++)
            s += (intervals[i].x1 - intervals[i].x0);
        return s;
    }

    private static readonly TARGET_FRACTION_SUM = 0.99999999;
    /**
     * For an array of points that make up a LineString, develops a line segment between each point pair,
     * and returns true if all segments lie inside this ClipVector.
     */
    public isLineStringCompletelyContained(points: Point3d[]): boolean {
        const clipIntervals: Segment1d[] = [];

        for (let i = 0; i + 1 < points.length; i++) {
            const segment = LineSegment3d.create(points[i], points[i + 1]);
            let fractionSum = 0.0;
            let index0 = 0;

            for (const clip of this._clips) {
                const clipPlaneSet = clip.fetchClipPlanesRef();
                clipPlaneSet.appendIntervalsFromSegment(segment, clipIntervals);
                const index1 = clipIntervals.length;
                fractionSum += this.sumSizes(clipIntervals, index0, index1);
                index0 = index1;
                // ASSUME primitives are non-overlapping...
                if (fractionSum >= ClipVector.TARGET_FRACTION_SUM)
                    break;
            }
            if (fractionSum < ClipVector.TARGET_FRACTION_SUM)
                return false;
        }
        return true;
    }
}
