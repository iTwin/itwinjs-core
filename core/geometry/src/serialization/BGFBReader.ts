/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { flatbuffers } from "flatbuffers";
import { assert } from "@itwin/core-bentley";
import { AkimaCurve3d, AkimaCurve3dOptions } from "../bspline/AkimaCurve3d";
import { BSplineCurve3d } from "../bspline/BSplineCurve";
import { BSplineCurve3dH } from "../bspline/BSplineCurve3dH";
import { BSplineSurface3d, BSplineSurface3dH, UVSelect } from "../bspline/BSplineSurface";
import { InterpolationCurve3d, InterpolationCurve3dOptions } from "../bspline/InterpolationCurve3d";
import { Arc3d } from "../curve/Arc3d";
import { BagOfCurves, CurveCollection } from "../curve/CurveCollection";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { GeometryQuery } from "../curve/GeometryQuery";
import { LineSegment3d } from "../curve/LineSegment3d";
import { LineString3d } from "../curve/LineString3d";
import { Loop } from "../curve/Loop";
import { ParityRegion } from "../curve/ParityRegion";
import { Path } from "../curve/Path";
import { PointString3d } from "../curve/PointString3d";
import { DirectSpiral3d } from "../curve/spiral/DirectSpiral3d";
import { IntegratedSpiral3d } from "../curve/spiral/IntegratedSpiral3d";
import { TransitionSpiral3d } from "../curve/spiral/TransitionSpiral3d";
import { UnionRegion } from "../curve/UnionRegion";
import { Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { AngleSweep } from "../geometry3d/AngleSweep";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { NumberArray, Point3dArray } from "../geometry3d/PointHelpers";
import { Ray3d } from "../geometry3d/Ray3d";
import { Segment1d } from "../geometry3d/Segment1d";
import { Transform } from "../geometry3d/Transform";
import { AuxChannel, AuxChannelData, PolyfaceAuxData } from "../polyface/AuxData";
import { IndexedPolyface } from "../polyface/Polyface";
import { TaggedNumericData } from "../polyface/TaggedNumericData";
import { Box } from "../solid/Box";
import { Cone } from "../solid/Cone";
import { LinearSweep } from "../solid/LinearSweep";
import { RotationalSweep } from "../solid/RotationalSweep";
import { RuledSweep } from "../solid/RuledSweep";
import { SolidPrimitive } from "../solid/SolidPrimitive";
import { Sphere } from "../solid/Sphere";
import { TorusPipe } from "../solid/TorusPipe";
import { BGFBAccessors } from "./BGFBAccessors";
import { SerializationHelpers } from "./SerializationHelpers";

/** * Context to write to a flatbuffer blob.
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
    let newSurface: BSplineSurface3d | BSplineSurface3dH | undefined;
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
        const closedU = bsurfHeader.closedU();
        const closedV = bsurfHeader.closedV();

        if (xyzArray !== null && knotArrayU !== null && knotArrayV !== null) {
          const myData = SerializationHelpers.createBSplineSurfaceData(xyzArray, 3, knotArrayU, numPolesU, orderU, knotArrayV, numPolesV, orderV);
          if (weightArray !== null)
            myData.weights = weightArray;
          if (closedU)
            myData.uParams.closed = true;
          if (closedV)
            myData.vParams.closed = true;

          if (SerializationHelpers.Import.prepareBSplineSurfaceData(myData, {jsonPoles: false})) {
            if (undefined === myData.weights)
              newSurface = BSplineSurface3d.create(myData.poles as Float64Array, myData.uParams.numPoles, myData.uParams.order, myData.uParams.knots, myData.vParams.numPoles, myData.vParams.order, myData.vParams.knots);
            else
              newSurface = BSplineSurface3dH.create(myData.poles as Float64Array, myData.weights as Float64Array, myData.uParams.numPoles, myData.uParams.order, myData.uParams.knots, myData.vParams.numPoles, myData.vParams.order, myData.vParams.knots);

            if (undefined !== newSurface) {
              if (undefined !== myData.uParams.wrapMode)
                newSurface.setWrappable(UVSelect.uDirection, myData.uParams.wrapMode);
              if (undefined !== myData.vParams.wrapMode)
                newSurface.setWrappable(UVSelect.vDirection, myData.vParams.wrapMode);
            }
          }
        }
      }
    }
    return newSurface;
  }

 /**
 * Extract an interpolating curve
 * @param variant read position in the flat buffer.
 */
  public readInterpolationCurve3d(header: BGFBAccessors.InterpolationCurve): InterpolationCurve3d | undefined {
    const xyzArray = header.fitPointsArray();
    if (xyzArray instanceof Float64Array){
      const knots = header.knotsArray();
      const options = new InterpolationCurve3dOptions(Point3dArray.clonePoint3dArray(xyzArray), knots ? NumberArray.create(knots) : undefined);
      const startTangent = header.startTangent();
      const endTangent = header.endTangent();
      options.captureOptionalProps(
        header.order(),
        header.closed(),
        header.isChordLenKnots(),
        header.isColinearTangents(),
        header.isChordLenTangents(),
        header.isNaturalTangents (),
        startTangent !== null ? Vector3d.create(startTangent.x(), startTangent.y(), startTangent.z()) : undefined,
        endTangent !== null ? Vector3d.create(endTangent.x(), endTangent.y(), endTangent.z()) : undefined);
      return InterpolationCurve3d.createCapture(options);
    }
  return undefined;
}

/**
 * Extract an akima curve
 * @param variant read position in the flat buffer.
 */
 public readAkimaCurve3d(header: BGFBAccessors.AkimaCurve): AkimaCurve3d | undefined {
  const xyzArray = header.pointsArray();
  if (xyzArray instanceof Float64Array){
    const options = new AkimaCurve3dOptions(Point3dArray.clonePoint3dArray(xyzArray));
    return AkimaCurve3d.createCapture(options);
  }
return undefined;
}
/**
   * Extract a bspline curve
   * @param variant read position in the flat buffer.
   */
  public readBSplineCurve(header: BGFBAccessors.BsplineCurve): BSplineCurve3d | BSplineCurve3dH | undefined {
    let newCurve: BSplineCurve3d | BSplineCurve3dH | undefined;
    const order = header.order();
    const xyzArray = header.polesArray();
    const knots = header.knotsArray();
    const weightsArray = header.weightsArray();
    const closed = header.closed();

    if (xyzArray !== null && knots !== null) {
      const numPoles = Math.floor(xyzArray.length / 3);
      const myData = SerializationHelpers.createBSplineCurveData(xyzArray, 3, knots, numPoles, order);
      if (closed)
        myData.params.closed = true;

      if (weightsArray === null) {
        if (SerializationHelpers.Import.prepareBSplineCurveData(myData))
          newCurve = BSplineCurve3d.create(myData.poles, myData.params.knots, myData.params.order);
      } else {
        myData.weights = weightsArray;
        if (SerializationHelpers.Import.prepareBSplineCurveData(myData, {jsonPoles: false}))
          newCurve = BSplineCurve3dH.create({ xyz: myData.poles as Float64Array, weights: myData.weights }, myData.params.knots, myData.params.order);
      }

      if (undefined !== newCurve) {
        if (undefined !== myData.params.wrapMode)
          newCurve.setWrappable(myData.params.wrapMode);
      }
    }
    return newCurve;
  }
  /**
   * Extract a bspline curve
   * @param variant read position in the flat buffer.
   */
  public readTransitionSpiral(header: BGFBAccessors.TransitionSpiral): TransitionSpiral3d | undefined {
    const detailHeader = header.detail();
    if (detailHeader) {
      const directDetailHeader = header.directDetail();
      const _extraDataArray = header.extraDataArray();
      const spiralTypeName = DgnSpiralTypeQueries.typeCodeToString(detailHeader.spiralType());
      const curvature0 = detailHeader.curvature0();
      const curvature1 = detailHeader.curvature1();
      const bearing0Radians = detailHeader.bearing0Radians();
      const bearing1Radians = detailHeader.bearing1Radians();
      const fbTransform = detailHeader.transform();
      const localToWorld = fbTransform ? Transform.createRowValues(
        fbTransform.axx(), fbTransform.axy(), fbTransform.axz(), fbTransform.axw(),
        fbTransform.ayx(), fbTransform.ayy(), fbTransform.ayz(), fbTransform.ayw(),
        fbTransform.azx(), fbTransform.azy(), fbTransform.azz(), fbTransform.azw()) :
        Transform.createIdentity();

      const activeFractionInterval = Segment1d.create(detailHeader.fractionA(),
        detailHeader.fractionB());
      if (!directDetailHeader) {
        const integratedSpiral = IntegratedSpiral3d.createRadiusRadiusBearingBearing(
          Segment1d.create(IntegratedSpiral3d.curvatureToRadius(curvature0), IntegratedSpiral3d.curvatureToRadius(curvature1)),
          AngleSweep.createStartEndRadians(bearing0Radians, bearing1Radians),
          activeFractionInterval, localToWorld, spiralTypeName);
        if (integratedSpiral)
          return integratedSpiral;
        const radius0 = TransitionSpiral3d.curvatureToRadius(curvature0);
        const radius1 = TransitionSpiral3d.curvatureToRadius(curvature1);
        const arcLength = TransitionSpiral3d.radiusRadiusSweepRadiansToArcLength(radius0, radius1,
          bearing1Radians - bearing0Radians);
        const directSpiral = DirectSpiral3d.createFromLengthAndRadius(
          spiralTypeName!,
          radius0, radius1,
          Angle.createRadians(bearing0Radians),
          Angle.createRadians (bearing1Radians),
          arcLength,
          activeFractionInterval,
          localToWorld);
        if (directSpiral)
          return directSpiral;
      }
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
        result.packedPoints.pushXYZ(offsetToLineString.points(i)!, offsetToLineString.points(i + 1)!, offsetToLineString.points(i + 2)!);
      }
      return result;
    } else if (geometryType === BGFBAccessors.VariantGeometryUnion.tagBsplineCurve) {
      const offsetToBCurve = variant.geometry(new BGFBAccessors.BsplineCurve());
      if (offsetToBCurve !== null)
        return this.readBSplineCurve(offsetToBCurve);
    } else if (geometryType === BGFBAccessors.VariantGeometryUnion.tagTransitionSpiral) {
      const offsetToTransitionSpiralTable = variant.geometry(new BGFBAccessors.TransitionSpiral());
      if (offsetToTransitionSpiralTable !== null)
        return this.readTransitionSpiral(offsetToTransitionSpiralTable);
    } else if (geometryType === BGFBAccessors.VariantGeometryUnion.tagInterpolationCurve) {
      const offsetToInterpolationCurveTable = variant.geometry(new BGFBAccessors.InterpolationCurve());
      if (offsetToInterpolationCurveTable !== null)
        return this.readInterpolationCurve3d(offsetToInterpolationCurveTable);
    } else if (geometryType === BGFBAccessors.VariantGeometryUnion.tagAkimaCurve) {
      const offsetToAkimaCurveTable = variant.geometry(new BGFBAccessors.AkimaCurve());
      if (offsetToAkimaCurveTable !== null)
        return this.readAkimaCurve3d(offsetToAkimaCurveTable);
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
  /** Extract auxData channel data for a mesh */
  public readPolyfaceAuxChannelData(channelDataHeader: BGFBAccessors.PolyfaceAuxChannelData | null): AuxChannelData | undefined {
    if (channelDataHeader !== null) {
      const input = channelDataHeader.input();
      const values = channelDataHeader.valuesArray();
      if (values !== null)
        return new AuxChannelData(input, values);
    }
    return undefined;
  }

  /** Extract auxData channel for a mesh */
  public readPolyfaceAuxChannel(channelHeader: BGFBAccessors.PolyfaceAuxChannel | null): AuxChannel | undefined {
    if (channelHeader) {
      const dataType = channelHeader.dataType();
      const dataLength = channelHeader.dataLength();
      const channelDataArray: AuxChannelData[] = [];
      const name = channelHeader.name();
      const inputName = channelHeader.inputName();
      for (let i = 0; i < dataLength; i++) {
        const channelData = this.readPolyfaceAuxChannelData(channelHeader.data(i));
        if (channelData)
          channelDataArray.push(channelData);
      }
      return new AuxChannel(channelDataArray, dataType, name ? name : undefined, inputName ? inputName : undefined);
    }
    return undefined;
  }

  /** Compute the number of logical entries in every flat data array in the AuxData */
  private static channelDataLength(fbAuxData: BGFBAccessors.PolyfaceAuxData): number {
    if (fbAuxData.channelsLength() <= 0)
      return 0;

    const fbChannel0 = nullToUndefined<BGFBAccessors.PolyfaceAuxChannel>(fbAuxData.channels(0));
    if (!fbChannel0)
      return 0;

    const numChannel0Data = fbChannel0.dataLength();
    if (numChannel0Data <= 0)
      return 0;

    const fbChannel0Data0 = nullToUndefined<BGFBAccessors.PolyfaceAuxChannelData>(fbChannel0.data(0));
    if (!fbChannel0Data0)
      return 0;

    const numChannelDataValues = fbChannel0Data0.valuesLength();
    if (numChannelDataValues <= 0)
      return 0;

    return numChannelDataValues / AuxChannel.entriesPerValue(fbChannel0.dataType());
  }

  /** Examine int array for range and zero count  */
  private countIntArray(ints: Int32Array): { min: number, max: number, numZeroes: number } {
    let min = Infinity;
    let max = -Infinity;
    let numZeroes = 0;
    for (const i of ints) {
      if (min > i)
        min = i;
      if (max < i)
        max = i;
      if (0 === i)
        ++numZeroes;
    }
    return {min, max, numZeroes};
  }

  /**
   * Extract auxData for a mesh.
   * Typescript object format for Polyface/PolyfaceAuxData indices is 0-based, unterminated.
   * FlatBuffer format for Polyface/PolyfaceAuxData indices is 1-based, 0-terminated/padded.
   * Typescript API previously wrote FlatBuffer PolyfaceAuxData indices as 0-based, unterminated;
   * heuristics are used herein to identify this legacy format so it can still be read.
   */
  public readPolyfaceAuxData(fbPolyface: BGFBAccessors.Polyface | null, fbAuxData: BGFBAccessors.PolyfaceAuxData | null): PolyfaceAuxData | undefined {
    if (!fbPolyface || !fbAuxData)
      return undefined;

    const fbPointIndices = nullToUndefined<Int32Array>(fbPolyface.pointIndexArray());
    const fbAuxIndices = nullToUndefined<Int32Array>(fbAuxData.indicesArray());
    const numChannels = fbAuxData.channelsLength();
    const fbNumData = BGFBReader.channelDataLength(fbAuxData);
    if (!fbPointIndices || !fbPointIndices.length || !fbAuxIndices || !fbAuxIndices.length || numChannels <= 0 || fbNumData <= 0)
      return undefined;

    const numPerFace = fbPolyface.numPerFace();

    // HEURISTICS to detect legacy AuxData indices, previously mistakenly serialized by BGFBWriter.writePolyfaceAsFBVariantGeometry as 0-based unblocked indices
    let isLegacy = false;
    const pointIndicesPadCount = fbPointIndices.filter((index) => index === 0).length;
    if (numPerFace > 1) {
      const auxIndexCounts = this.countIntArray(fbAuxIndices);
      if (auxIndexCounts.max > fbNumData) // auxIndices invalid
        return undefined;
      if (auxIndexCounts.max === fbNumData) // auxIndices 1-based
        isLegacy = false;
      else if (auxIndexCounts.max <= 0 || auxIndexCounts.min < 0) // auxIndices 1-based (signed)
        isLegacy = false;
      else if (auxIndexCounts.min === 0) // auxIndices likely legacy 0-based index, but could be modern with padding
        isLegacy = pointIndicesPadCount !== auxIndexCounts.numZeroes;
      else if (auxIndexCounts.min > 0) // auxIndices likely modern without padding, but could be legacy if first datum not indexed
        isLegacy = pointIndicesPadCount > 0;
    } else {
      isLegacy = (fbAuxIndices.length < fbPointIndices.length) && (fbAuxIndices.length + pointIndicesPadCount === fbPointIndices.length);
    }
    if (!isLegacy && fbAuxIndices.length !== fbPointIndices.length)
      return undefined; // auxIndices invalid

    const indices: number[] = [];
    if (isLegacy)
      SerializationHelpers.announceZeroBasedIndicesWithExternalBlocking(fbAuxIndices, fbPointIndices, numPerFace, (i0: number) => { indices.push(i0); });
    else
      SerializationHelpers.announceZeroBasedIndicesFromSignedOneBasedIndices(fbAuxIndices, numPerFace, (i0: number) => { indices.push(i0); });
    if (indices.length + pointIndicesPadCount !== fbPointIndices.length)
      return undefined;
    const maxIndex = Math.max(...indices);

    const channels: AuxChannel[] = [];
    for (let i = 0; i < numChannels; i++) {
      const channelHeader = fbAuxData.channels(i);
      const channelContent = this.readPolyfaceAuxChannel(channelHeader);
      if (channelContent) {
        if (maxIndex >= channelContent.valueCount)
          return undefined; // invalid index
        channels.push(channelContent);
      }
    }
    if (!channels.length)
      return undefined;

    return new PolyfaceAuxData(channels, indices);
  }

  /** Extract tagged numeric data for a mesh */
  public readTaggedNumericData(accessor: BGFBAccessors.TaggedNumericData | undefined): TaggedNumericData | undefined {
    if (accessor) {
      const taggedNumericData = new TaggedNumericData(accessor.tagA(), accessor.tagB());
      const intDataArray = nullToUndefined<Int32Array>(accessor.intDataArray());
      const doubleDataArray = nullToUndefined<Float64Array>(accessor.doubleDataArray());
      if (intDataArray) {
        taggedNumericData.intData = [];
        for (const c of intDataArray)
          taggedNumericData.intData.push(c);

      }
      if (doubleDataArray) {
        taggedNumericData.doubleData = [];
        for (const c of doubleDataArray)
          taggedNumericData.doubleData.push(c);
      }
      return taggedNumericData;
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
      const polyfaceHeader = variant.geometry(new BGFBAccessors.Polyface());
      if (polyfaceHeader) {
        const twoSided = polyfaceHeader.twoSided();
        const expectedClosure = polyfaceHeader.expectedClosure();
        const meshStyle = polyfaceHeader.meshStyle();
        const numPerFace = polyfaceHeader.numPerFace();

        const pointF64 = nullToUndefined<Float64Array>(polyfaceHeader.pointArray());
        const paramF64 = nullToUndefined<Float64Array>(polyfaceHeader.paramArray());
        const normalF64 = nullToUndefined<Float64Array>(polyfaceHeader.normalArray());
        const intColorU32 = nullToUndefined<Uint32Array>(polyfaceHeader.intColorArray());

        const pointIndexI32 = nullToUndefined<Int32Array>(polyfaceHeader.pointIndexArray());
        const paramIndexI32 = nullToUndefined<Int32Array>(polyfaceHeader.paramIndexArray());
        const normalIndexI32 = nullToUndefined<Int32Array>(polyfaceHeader.normalIndexArray());
        const colorIndexI32 = nullToUndefined<Int32Array>(polyfaceHeader.colorIndexArray());
        const taggedNumericDataOffset = polyfaceHeader.taggedNumericData();

        assert(meshStyle === 1, "Unrecognized flatbuffer mesh style");

        // The flatbuffer data is one based.
        // If numPerFace is less than 2, facets are variable size and zero terminated
        // If numPerFace is 2 or more, indices are blocked
        if (meshStyle === 1 && pointF64 && pointIndexI32) {
          const polyface = IndexedPolyface.create();
          polyface.twoSided = twoSided;
          polyface.expectedClosure = expectedClosure;

          if (normalF64 && normalIndexI32) {
            for (let i = 0; i + 2 < normalF64.length; i += 3)
              polyface.addNormalXYZ(normalF64[i], normalF64[i + 1], normalF64[i + 2]);
            SerializationHelpers.announceZeroBasedIndicesFromSignedOneBasedIndices(normalIndexI32, numPerFace,
              (i: number) => { polyface.addNormalIndex(i); });
          }
          if (paramF64 && paramIndexI32) {
            for (let i = 0; i + 1 < paramF64.length; i += 2)
              polyface.addParamUV(paramF64[i], paramF64[i + 1]);
            SerializationHelpers.announceZeroBasedIndicesFromSignedOneBasedIndices(paramIndexI32, numPerFace,
              (i: number) => { polyface.addParamIndex(i); });
          }
          if (intColorU32 && colorIndexI32) {
            for (const c of intColorU32)
              polyface.addColor(c);
            SerializationHelpers.announceZeroBasedIndicesFromSignedOneBasedIndices(colorIndexI32, numPerFace,
              (i: number) => { polyface.addColorIndex(i); });
          }

          for (let i = 0; i + 2 < pointF64.length; i += 3)
            polyface.addPointXYZ(pointF64[i], pointF64[i + 1], pointF64[i + 2]);
          SerializationHelpers.announceZeroBasedIndicesFromSignedOneBasedIndices(pointIndexI32, numPerFace,
            (i: number, v?: boolean) => { polyface.addPointIndex(i, v); },
            () => { polyface.terminateFacet(false); });

          if (!polyface.validateAllIndices())
            return undefined;

          polyface.data.auxData = this.readPolyfaceAuxData(polyfaceHeader, polyfaceHeader.auxData());

          if (taggedNumericDataOffset) {
              const taggedNumericDataAccessor = nullToUndefined<BGFBAccessors.TaggedNumericData>(taggedNumericDataOffset);
              if (taggedNumericDataAccessor !== undefined) {
                const taggedNumericData = this.readTaggedNumericData(taggedNumericDataAccessor);
                if (taggedNumericData !== undefined)
                  polyface.data.setTaggedNumericData(taggedNumericData);
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
      case BGFBAccessors.VariantGeometryUnion.tagTransitionSpiral:
      case BGFBAccessors.VariantGeometryUnion.tagInterpolationCurve:
        case BGFBAccessors.VariantGeometryUnion.tagAkimaCurve:
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
/**
 * mappings between typescript spiral type strings and native integers.
 * @internal
 */
export class DgnSpiralTypeQueries {
  // remark: this is the full list based on native DSpiral2dBase.h.
  //   This does not guarantee all types are supported.
  private static spiralTypeCodeMap = [
    [10, "clothoid"],
    [11, "bloss"],
    [12, "biquadratic"],
    [13, "cosine"],
    [14, "sine"],
    [15, "Viennese"],
    [16, "weightedViennese"],

    [50, "WesternAustralian"],
    [51, "Czech"],
    [52, "AustralianRailCorp"],
    [53, "Italian"],
    [54, "PolishCubic"],
    [55, "Arema"],
    [56, "MXCubicAlongArc"],
    [57, "MXCubicAlongTangent"],
    [58, "ChineseCubic"],
    [60, "HalfCosine"],
    [61, "JapaneseCubic"],
  ];
  /** Convert native integer type (e.g. from flatbuffer) to typescript string */
  public static typeCodeToString(typeCode: number): string | undefined {
    for (const entry of DgnSpiralTypeQueries.spiralTypeCodeMap) {
      if (entry[0] === typeCode)
        return entry[1] as string;
    }
    return undefined;
  }

  /** Convert typescript string to native integer type */
  public static stringToTypeCode(s: string, defaultToClothoid: boolean = true): number | undefined {
    for (const entry of DgnSpiralTypeQueries.spiralTypeCodeMap) {
      if (Geometry.equalStringNoCase(s, entry[1] as string))
        return entry[0] as number;
    }
    return defaultToClothoid ? 10 : undefined;
  }
  /** Ask if the indicated type code is a "direct" spiral */
  public static isDirectSpiralType(typeCode: number): boolean {
    return typeCode >= 50;
  }
}
