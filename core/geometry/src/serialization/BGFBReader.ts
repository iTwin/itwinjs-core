/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { flatbuffers } from "flatbuffers";
import { BGFBAccessors } from "./BGFBAccessors";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { LineSegment3d } from "../curve/LineSegment3d";
import { Arc3d } from "../curve/Arc3d";
import { AngleSweep } from "../geometry3d/AngleSweep";
import { LineString3d } from "../curve/LineString3d";
import { IndexedPolyface } from "../polyface/Polyface";
import { BagOfCurves, CurveCollection } from "../curve/CurveCollection";
import { Loop } from "../curve/Loop";
import { Path } from "../curve/Path";
import { UnionRegion } from "../curve/UnionRegion";
import { ParityRegion } from "../curve/ParityRegion";
import { BSplineCurve3dH } from "../bspline/BSplineCurve3dH";
import { BSplineCurve3d } from "../bspline/BSplineCurve";
import { SolidPrimitive } from "../solid/SolidPrimitive";
import { Box } from "../solid/Box";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";
import { Sphere } from "../solid/Sphere";
import { Cone } from "../solid/Cone";
import { TorusPipe } from "../solid/TorusPipe";
import { Angle } from "../geometry3d/Angle";
import { LinearSweep } from "../solid/LinearSweep";
import { RotationalSweep } from "../solid/RotationalSweep";
import { Ray3d } from "../geometry3d/Ray3d";
import { RuledSweep } from "../solid/RuledSweep";
import { GeometryQuery } from "../curve/GeometryQuery";
import { BSplineSurface3d, BSplineSurface3dH } from "../bspline/BSplineSurface";
import { PointString3d } from "../curve/PointString3d";

/**
 * Context to write to a flatbuffer blob.
 * @internal
 *  * This class is internal.
 *  * Public access is through BentleyGeometryFlatBuffer.geometryToBytes()
 * @internal
 */
export class BGFBReader {
  public constructor() {
  }
  /**
   * Extract a bspline surface
   * @param variant read position in the flat buffer.
   */
  public readBSplineSurfaceFromVariant(variantHeader: BGFBAccessors.VariantGeometry): BSplineSurface3d | BSplineSurface3dH | undefined {
    const geometryType = variantHeader.geometryType();
    if (geometryType === BGFBAccessors.VariantGeometryUnion.tagBsplineSurface) {
      const bsurfHeader = variantHeader.geometry(new BGFBAccessors.BsplineSurface());
      if (bsurfHeader !== null) {
        const orderU = bsurfHeader.orderU();
        const orderV = bsurfHeader.orderV();
        const numPolesU = bsurfHeader.numPolesU();
        const numPolesV = bsurfHeader.numPolesV();
        const xyzArray = bsurfHeader.polesArray();
        const knotArrayU = bsurfHeader.knotsUArray();
        const knotArrayV = bsurfHeader.knotsVArray();
        const weightArray = bsurfHeader.weightsArray();
        // const closed = header.closed();
        if (xyzArray !== null && knotArrayU !== null && knotArrayV !== null)
          if (weightArray === null) {
            return BSplineSurface3d.create(xyzArray, numPolesU, orderU, knotArrayU, numPolesV, orderV, knotArrayV);
          } else {
            return BSplineSurface3dH.create(xyzArray, weightArray, numPolesU, orderU, knotArrayU, numPolesV, orderV, knotArrayV);
          }
      }
    }
    return undefined;
  }
  /**
   * Extract a bspline curve
   * @param variant read position in the flat buffer.
   */
  public readBSplineCurve(header: BGFBAccessors.BsplineCurve): BSplineCurve3d | BSplineCurve3dH | undefined {
    const order = header.order();
    const xyzArray = header.polesArray();
    const knots = header.knotsArray();
    const weightsArray = header.weightsArray();
    // const closed = header.closed();
    if (xyzArray !== null && knots !== null)
      if (weightsArray === null) {
        return BSplineCurve3d.create(xyzArray, knots, order);
      } else {
        return BSplineCurve3dH.create({ xyz: xyzArray, weights: weightsArray }, knots, order);
      }
    return undefined;
  }
  /**
   * Extract a curve primitive
   * @param variant read position in the flat buffer.
   */
  public readCurvePrimitiveFromVariant(variant: BGFBAccessors.VariantGeometry): CurvePrimitive | undefined {
    const geometryType = variant.geometryType();
    if (geometryType === BGFBAccessors.VariantGeometryUnion.tagLineSegment) {
      const offsetToLineSegment = variant.geometry(new BGFBAccessors.LineSegment());
      const offsetToCoordinates = offsetToLineSegment!.segment();
      return LineSegment3d.createXYZXYZ(
        offsetToCoordinates!.point0X(), offsetToCoordinates!.point0Y(), offsetToCoordinates!.point0Z(),
        offsetToCoordinates!.point1X(), offsetToCoordinates!.point1Y(), offsetToCoordinates!.point1Z());
    } else if (geometryType === BGFBAccessors.VariantGeometryUnion.tagEllipticArc) {
      const offsetToEllipticArc = variant.geometry(new BGFBAccessors.EllipticArc());
      const offsetToCoordinates = offsetToEllipticArc!.arc()!;
      return Arc3d.createXYZXYZXYZ(
        offsetToCoordinates.centerX(), offsetToCoordinates.centerY(), offsetToCoordinates.centerZ(),
        offsetToCoordinates.vector0X(), offsetToCoordinates.vector0Y(), offsetToCoordinates.vector0Z(),
        offsetToCoordinates.vector90X(), offsetToCoordinates.vector90Y(), offsetToCoordinates.vector90Z(),
        AngleSweep.createStartSweepRadians(offsetToCoordinates.startRadians(), offsetToCoordinates?.sweepRadians()));
    } else if (geometryType === BGFBAccessors.VariantGeometryUnion.tagLineString) {
      const offsetToLineString = variant.geometry(new BGFBAccessors.LineString())!;
      const numCoordinates = offsetToLineString.pointsLength();
      const result = LineString3d.create();
      for (let i = 0; i + 2 < numCoordinates; i += 3) {
        result.packedPoints.pushXYZ(offsetToLineString.points(i)!, offsetToLineString?.points(i + 1)!, offsetToLineString?.points(i + 2)!);
      }
      return result;
    } else if (geometryType === BGFBAccessors.VariantGeometryUnion.tagBsplineCurve) {
      const offsetToBCurve = variant.geometry(new BGFBAccessors.BsplineCurve());
      if (offsetToBCurve !== null)
        return this.readBSplineCurve(offsetToBCurve);
    } else if (geometryType === BGFBAccessors.VariantGeometryUnion.tagTransitionSpiral) {
    }
    return undefined;
  }
  /**
   * Extract a curve primitive
   * @param variant read position in the flat buffer.
   */
  public readPointStringFromVariant(variant: BGFBAccessors.VariantGeometry): PointString3d | undefined {
    const geometryType = variant.geometryType();
    if (geometryType === BGFBAccessors.VariantGeometryUnion.tagPointString) {
      const offsetToLineString = variant.geometry(new BGFBAccessors.PointString())!;
      const numCoordinates = offsetToLineString.pointsLength();
      const result = PointString3d.create();
      for (let i = 0; i + 2 < numCoordinates; i += 3) {
        result.points.push(Point3d.create(offsetToLineString.points(i)!, offsetToLineString.points(i + 1)!, offsetToLineString.points(i + 2)!));
      }
      return result;
    }
    return undefined;
  }

  /**
 * Extract a mesh
 * @param variant read position in the flat buffer.
 */
  public readPolyfaceFromVariant(variant: BGFBAccessors.VariantGeometry): IndexedPolyface | undefined {
    const geometryType = variant.geometryType();
    if (geometryType === BGFBAccessors.VariantGeometryUnion.tagPolyface) {
      const offsetToPolyface = variant.geometry(new BGFBAccessors.Polyface());
      if (offsetToPolyface) {
        const twoSided = offsetToPolyface.twoSided();
        const meshStyle = offsetToPolyface.meshStyle();

        const pointF64 = nullToUndefined<Float64Array>(offsetToPolyface.pointArray());
        const paramF64 = nullToUndefined<Float64Array>(offsetToPolyface.paramArray());
        const normalF64 = nullToUndefined<Float64Array>(offsetToPolyface.normalArray());
        const intColorU32 = nullToUndefined<Uint32Array>(offsetToPolyface.intColorArray());

        const pointIndexI32 = nullToUndefined<Int32Array>(offsetToPolyface.pointIndexArray());
        const paramIndexI32 = nullToUndefined<Int32Array>(offsetToPolyface.paramIndexArray());
        const normalIndexI32 = nullToUndefined<Int32Array>(offsetToPolyface.normalIndexArray());
        const colorIndexI32 = nullToUndefined<Int32Array>(offsetToPolyface.colorIndexArray());
        // const colorIndexI32 = nullToUndefined<Int32Array>(offsetToPolyface.colorIndexArray());
        if (meshStyle === 1 && pointF64 && pointIndexI32) {
          const polyface = IndexedPolyface.create(normalF64 !== undefined, paramF64 !== undefined, intColorU32 !== undefined, twoSided);
          for (let i = 0; i + 2 < pointF64?.length; i += 3)
            polyface.data.point.pushXYZ(pointF64[i], pointF64[i + 1], pointF64[i + 2]);
          if (paramF64) {
            for (let i = 0; i + 1 < paramF64?.length; i += 2)
              polyface.data.param!.pushXY(paramF64[i], paramF64[i + 1]);
          }
          if (normalF64) {
            for (let i = 0; i + 2 < normalF64?.length; i += 3)
              polyface.data.normal!.pushXYZ(normalF64[i], normalF64[i + 1], normalF64[i + 2]);
          }
          if (intColorU32) {
            for (const c of intColorU32)
              polyface.data.color!.push(c);
          }
          // The flatbuffer data is one based, zero terminated.
          // polyface data needs zero based with counts in the IndexedPolyface.
          let i0 = 0;
          const numIndex = pointIndexI32.length;
          for (let i1 = i0; i1 < numIndex; i1++) {
            if (pointIndexI32[i1] === 0) {
              if (i1 > i0) {
                for (let i = i0; i < i1; i++) {
                  const q = pointIndexI32[i];
                  polyface.addPointIndex(Math.abs(q) - 1, q > 0);
                  if (normalF64 && normalIndexI32) {
                    polyface.addNormalIndex(Math.abs(normalIndexI32[i]) - 1);
                  }
                  if (paramF64 && paramIndexI32) {
                    polyface.addParamIndex(Math.abs(paramIndexI32[i]) - 1);
                  }
                  if (intColorU32 && colorIndexI32) {
                    polyface.addColorIndex(Math.abs(colorIndexI32[i]) - 1);
                  }
                }
              }
              polyface.terminateFacet(true);
              i0 = i1 + 1;
            }
          }
          return polyface;
        }
      }

    }
    return undefined;
  }

  public readCurveCollectionFromCurveVectorTable(cvTable: BGFBAccessors.CurveVector): CurveCollection {
    const numChildren = cvTable.curvesLength();
    const collectionType = cvTable.type();
    const collection = createTypedCurveCollection(collectionType);
    for (let i = 0; i < numChildren; i++) {
      const childOffset = cvTable.curves(i);
      if (childOffset !== null) {
        const child = this.readCurvePrimitiveFromVariant(childOffset);
        if (child)
          collection.tryAddChild(child);
        else {
          const childCollection = this.readCurveCollectionFromVariantGeometry(childOffset);
          if (childCollection)
            collection.tryAddChild(childCollection);
        }
      }
    }
    return collection;
  }
  /**
 * Extract a curve collection
 * @param variant read position in the flat buffer.
 */
  public readCurveCollectionFromVariantGeometry(variant: BGFBAccessors.VariantGeometry): CurveCollection | undefined {
    const geometryType = variant.geometryType();
    if (geometryType === BGFBAccessors.VariantGeometryUnion.tagCurveVector) {
      const cvTable = variant.geometry(new BGFBAccessors.CurveVector())!;
      return this.readCurveCollectionFromCurveVectorTable(cvTable);
    }
    return undefined;
  }
  /**
 * Extract a curve collection
 * @param variant read position in the flat buffer.
 */
  public readSolidPrimitiveFromVariant(variant: BGFBAccessors.VariantGeometry): SolidPrimitive | undefined {
    const geometryType = variant.geometryType();
    if (geometryType === BGFBAccessors.VariantGeometryUnion.tagDgnBox) {
      const header = variant.geometry(new BGFBAccessors.DgnBox());
      const detail = header!.detail()!;
      return Box.createDgnBox(
        Point3d.create(detail.baseOriginX(), detail.baseOriginY(), detail.baseOriginZ()),
        Vector3d.create(detail.vectorXX(), detail.vectorXY(), detail.vectorXZ()),
        Vector3d.create(detail.vectorYX(), detail.vectorYY(), detail.vectorYZ()),
        Point3d.create(detail.topOriginX(), detail.topOriginY(), detail.topOriginZ()),
        detail.baseX(), detail.baseY(), detail.topX(), detail.topY(),
        detail.capped());
    } if (geometryType === BGFBAccessors.VariantGeometryUnion.tagDgnSphere) {
      const header = variant.geometry(new BGFBAccessors.DgnSphere());
      const detail = header!.detail()!;
      const lToWDetail = detail.localToWorld()!;
      const localToWorld = Transform.createRowValues(
        lToWDetail.axx(), lToWDetail.axy(), lToWDetail.axz(), lToWDetail.axw(),
        lToWDetail.ayx(), lToWDetail.ayy(), lToWDetail.ayz(), lToWDetail.ayw(),
        lToWDetail.azx(), lToWDetail.azy(), lToWDetail.azz(), lToWDetail.azw());
      return Sphere.createEllipsoid(localToWorld,
        AngleSweep.createStartSweepRadians(detail.startLatitudeRadians(), detail.latitudeSweepRadians()),
        detail.capped());
    } if (geometryType === BGFBAccessors.VariantGeometryUnion.tagDgnCone) {
      const header = variant.geometry(new BGFBAccessors.DgnCone());
      const detail = header!.detail()!;
      const centerA = Point3d.create(detail.centerAX(), detail.centerAY(), detail.centerAZ());
      const centerB = Point3d.create(detail.centerBX(), detail.centerBY(), detail.centerBZ());
      const vector0 = Vector3d.create(detail.vector0X(), detail.vector0Y(), detail.vector0Z());
      const vector90 = Vector3d.create(detail.vector90X(), detail.vector90Y(), detail.vector90Z());
      const radiusA = detail.radiusA();
      const radiusB = detail.radiusB();
      return Cone.createBaseAndTarget(centerA, centerB, vector0, vector90, radiusA, radiusB, detail.capped());
    } if (geometryType === BGFBAccessors.VariantGeometryUnion.tagDgnTorusPipe) {
      const header = variant.geometry(new BGFBAccessors.DgnTorusPipe())!;
      const detail = header.detail()!;
      const center = Point3d.create(detail.centerX(), detail.centerY(), detail.centerZ());
      const vectorX = Vector3d.create(detail.vectorXX(), detail.vectorXY(), detail.vectorXZ());
      const vectorY = Vector3d.create(detail.vectorYX(), detail.vectorYY(), detail.vectorYZ());
      const sweepRadians = detail.sweepRadians();
      const majorRadius = detail.majorRadius();
      const minorRadius = detail.minorRadius();
      return TorusPipe.createDgnTorusPipe(center, vectorX, vectorY, majorRadius, minorRadius, Angle.createRadians(sweepRadians), detail.capped());
    } if (geometryType === BGFBAccessors.VariantGeometryUnion.tagDgnExtrusion) {
      const header = variant.geometry(new BGFBAccessors.DgnExtrusion())!;
      const dVector = new BGFBAccessors.DVector3d();
      header.extrusionVector(dVector);
      const extrusionVector = Vector3d.create(dVector.x(), dVector.y(), dVector.z());
      const baseCurve = header.baseCurve();
      if (baseCurve !== null) {
        const contour = this.readCurveCollectionFromCurveVectorTable(baseCurve);
        return LinearSweep.create(contour, extrusionVector, header.capped());
      }
    } if (geometryType === BGFBAccessors.VariantGeometryUnion.tagDgnRotationalSweep) {
      const header = variant.geometry(new BGFBAccessors.DgnRotationalSweep())!;
      const dAxis = new BGFBAccessors.DRay3d();
      header.axis(dAxis);
      const axis = Ray3d.createXYZUVW(dAxis.x(), dAxis.y(), dAxis.z(), dAxis.ux(), dAxis.uy(), dAxis.uz());
      const sweepAngle = Angle.createRadians(header.sweepRadians());
      // const numVRules = header.numVRules();
      const baseCurve = header.baseCurve();
      if (baseCurve !== null) {
        const contour = this.readCurveCollectionFromCurveVectorTable(baseCurve);
        return RotationalSweep.create(contour, axis, sweepAngle, header.capped());
      }
    } if (geometryType === BGFBAccessors.VariantGeometryUnion.tagDgnRuledSweep) {
      const header = variant.geometry(new BGFBAccessors.DgnRuledSweep())!;
      const numCurves = header.curvesLength();
      const contours: CurveCollection[] = [];
      for (let i = 0; i < numCurves; i++) {
        const contourTable = header.curves(i);
        if (contourTable) {
          const contour = this.readCurveCollectionFromCurveVectorTable(contourTable);
          if (contour)
            contours.push(contour);
        }
      }
      if (contours.length > 0) {
        return RuledSweep.create(contours, header.capped());
      }
    }
    return undefined;
  }
  /**
   * Extract any geometry type or array of geometry.
   * @param variant read position in the flat buffer.
   */
  public readGeometryQueryFromVariant(variant: BGFBAccessors.VariantGeometry): GeometryQuery | GeometryQuery[] | undefined {
    const rootType = variant.geometryType();
    switch (rootType) {
      case BGFBAccessors.VariantGeometryUnion.tagLineSegment:
      case BGFBAccessors.VariantGeometryUnion.tagLineString:
      case BGFBAccessors.VariantGeometryUnion.tagEllipticArc:
      case BGFBAccessors.VariantGeometryUnion.tagBsplineCurve:
        {
          return this.readCurvePrimitiveFromVariant(variant);
        }
      case BGFBAccessors.VariantGeometryUnion.tagCurveVector:
        {
          return this.readCurveCollectionFromVariantGeometry(variant);
        }
      case BGFBAccessors.VariantGeometryUnion.tagPolyface:
        {
          return this.readPolyfaceFromVariant(variant);
        }
      case BGFBAccessors.VariantGeometryUnion.tagDgnBox:
      case BGFBAccessors.VariantGeometryUnion.tagDgnCone:
      case BGFBAccessors.VariantGeometryUnion.tagDgnTorusPipe:
      case BGFBAccessors.VariantGeometryUnion.tagDgnSphere:
      case BGFBAccessors.VariantGeometryUnion.tagDgnExtrusion:
      case BGFBAccessors.VariantGeometryUnion.tagDgnRotationalSweep:
      case BGFBAccessors.VariantGeometryUnion.tagDgnRuledSweep:
        {
          return this.readSolidPrimitiveFromVariant(variant);
        }
      case BGFBAccessors.VariantGeometryUnion.tagVectorOfVariantGeometry:
        {
          const geometry: GeometryQuery[] = [];
          const offsetToVectorOfVariantGeometry = variant.geometry(new BGFBAccessors.VectorOfVariantGeometry());
          for (let i = 0; i < offsetToVectorOfVariantGeometry!.membersLength(); i++) {
            const child = offsetToVectorOfVariantGeometry!.members(i);
            if (child !== null) {
              const childGeometry = this.readGeometryQueryFromVariant(child);
              if (childGeometry instanceof GeometryQuery) {
                geometry.push(childGeometry);
              } else if (Array.isArray(childGeometry)) {
                geometry.push(...childGeometry);
              }
            }
          }
          return geometry;
        }
      case BGFBAccessors.VariantGeometryUnion.tagBsplineSurface: {
        return this.readBSplineSurfaceFromVariant(variant);
      }
      case BGFBAccessors.VariantGeometryUnion.tagPointString:
        {
          return this.readPointStringFromVariant(variant);
        }
    }
    return undefined;
  }
  /**
   * Deserialize bytes from a flatbuffer.
   * @param justTheBytes FlatBuffer bytes as created by BGFBWriter.createFlatBuffer (g);
   */
  public static bytesToGeometry(theBytes: Uint8Array, signature?: Uint8Array): GeometryQuery | GeometryQuery[] | undefined {
    const newByteBuffer = new flatbuffers.ByteBuffer(theBytes);
    if (signature) {
      if (theBytes.length < signature.length)
        return undefined;
      for (let i = 0; i < signature.length; i++)
        if (theBytes[i] !== signature[i])
          return undefined;
      newByteBuffer.setPosition(signature.length);
    }
    const root = BGFBAccessors.VariantGeometry.getRootAsVariantGeometry(newByteBuffer);
    const reader = new BGFBReader();
    return reader.readGeometryQueryFromVariant(root);
  }

}
/**
 * if data is "null" (the deprecated javascript idiom!) return undefined.  Otherwise return the data as its own type.
 * @param data
 */
function nullToUndefined<T>(data: any): T | undefined {
  if (data === null)
    return undefined;
  return data;
}

function createTypedCurveCollection(collectionType: number): CurveCollection {
  if (collectionType === 1) return new Path();
  if (collectionType === 2 || collectionType === 3) return new Loop();
  if (collectionType === 4) return new ParityRegion();
  if (collectionType === 5) return new UnionRegion();
  return new BagOfCurves();
}
