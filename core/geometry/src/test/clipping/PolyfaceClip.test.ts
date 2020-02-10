/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Checker } from "../Checker";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { ClipPlane } from "../../clipping/ClipPlane";
import { Sample } from "../../serialization/GeometrySamples";

import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

import { PolyfaceClip } from "../../polyface/PolyfaceClip";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { ConvexClipPlaneSet } from "../../clipping/ConvexClipPlaneSet";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { PolygonOps, IndexedXYZCollectionPolygonOps } from "../../geometry3d/PolygonOps";
import { RFunctions } from "../polyface/PolyfaceQuery.test";
import { LinearSweep } from "../../solid/LinearSweep";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Box } from "../../solid/Box";
import { Range3d } from "../../geometry3d/Range";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Transform } from "../../geometry3d/Transform";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Angle } from "../../geometry3d/Angle";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { Polyface, IndexedPolyface } from "../../polyface/Polyface";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import * as fs from "fs";
import { Geometry } from "../../Geometry";
/* tslint:disable:no-console */
describe("PolyfaceClip", () => {
  it("ClipPlane", () => {
    const ck = new Checker();
    const polyface = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.unitX(), Vector3d.unitY(), 3, 4);
    const clipper = ClipPlane.createNormalAndPointXYZXYZ(1, 1, 0, 1, 1, 1)!;

    const leftClip = PolyfaceClip.clipPolyface(polyface, clipper)!;
    const rightClip = PolyfaceClip.clipPolyfaceClipPlane(polyface, clipper, false)!;
    const area = PolyfaceQuery.sumFacetAreas(polyface);
    const areaLeft = PolyfaceQuery.sumFacetAreas(leftClip);
    const areaRight = PolyfaceQuery.sumFacetAreas(rightClip);
    const allGeometry: GeometryQuery[] = [];
    GeometryCoreTestIO.captureGeometry(allGeometry, polyface, 0, 0, 0);
    GeometryCoreTestIO.captureGeometry(allGeometry, leftClip, 0, 10, 0);
    GeometryCoreTestIO.captureGeometry(allGeometry, rightClip, 0, 10, 0);
    ck.testCoordinate(area, areaLeft + areaRight);
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "ClipPlane");
    expect(ck.getNumErrors()).equals(0);

  });

  it("EdgeInClipPlane", () => {
    const ck = new Checker();
    const polyface = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.unitX(), Vector3d.unitY(), 3, 2);
    const clipper = ClipPlane.createNormalAndPointXYZXYZ(1, 0, 0, 1, 0, 0)!;

    const leftClip = PolyfaceClip.clipPolyface(polyface, clipper)!;
    const rightClip = PolyfaceClip.clipPolyfaceClipPlane(polyface, clipper, false)!;
    const area = PolyfaceQuery.sumFacetAreas(polyface);
    const areaLeft = PolyfaceQuery.sumFacetAreas(leftClip);
    const areaRight = PolyfaceQuery.sumFacetAreas(rightClip);
    const allGeometry: GeometryQuery[] = [];
    GeometryCoreTestIO.captureGeometry(allGeometry, polyface, 0, 0, 0);
    GeometryCoreTestIO.captureGeometry(allGeometry, leftClip, 0, 10, 0);
    GeometryCoreTestIO.captureGeometry(allGeometry, rightClip, 0, 10, 0);
    ck.testCoordinate(area, areaLeft + areaRight);
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "EdgeInClipPlane");
    expect(ck.getNumErrors()).equals(0);

  });

  it("ConvexClipPlaneSet", () => {
    const ck = new Checker();
    const vectorU = Vector3d.create(1, -1, 0);
    const vectorV = Vector3d.create(1, 2, 0);
    const singleFacetArea = vectorU.crossProductMagnitude(vectorV);
    const xEdges = 4;
    const yEdges = 5;
    const polyface = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), vectorU, vectorV, xEdges + 1, yEdges + 1);
    const x0 = 2;
    const y0 = 0.5;
    const ax = 1.0;
    const ay = 2.0;
    const clipper = ConvexClipPlaneSet.createXYBox(x0, y0, x0 + ax, y0 + ay);

    // The mesh should be big enough to completely contain the clip -- hence output area is known .....
    const insidePart = PolyfaceClip.clipPolyface(polyface, clipper)!;
    const area = PolyfaceQuery.sumFacetAreas(polyface);
    const insideArea = PolyfaceQuery.sumFacetAreas(insidePart);
    ck.testCoordinate(xEdges * yEdges * singleFacetArea, area);
    const allGeometry: GeometryQuery[] = [];
    GeometryCoreTestIO.captureGeometry(allGeometry, polyface, 0, 0, 0);
    GeometryCoreTestIO.captureGeometry(allGeometry, insidePart.clone()!, 0, 0, 0);
    GeometryCoreTestIO.captureGeometry(allGeometry, insidePart, 0, 10, 0);

    ck.testCoordinate(ax * ay, insideArea);
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "ConvexClipPlaneSet");
    expect(ck.getNumErrors()).equals(0);
  });

  /** Test PolyfaceBuilder.addPolygon variants with reverse normals. */
  it("addPolygon", () => {
    const ck = new Checker();
    const points0 = [Point3d.create(0, 0), Point3d.create(1, 0), Point3d.create(0, 2)];
    const points1 = [Point3d.create(0, 0, 1), Point3d.create(1, 0, 1), Point3d.create(0, 2, 1), Point3d.create(0, 0, 1)]; // with duplicate !

    const growable0 = new GrowableXYZArray();
    growable0.pushFrom(points0);
    const growable1 = new GrowableXYZArray();
    growable1.pushFrom(points1);

    const singleFacetArea = PolygonOps.areaNormalGo(growable0)!.magnitude();
    const builderG = PolyfaceBuilder.create();

    builderG.addPolygonGrowableXYZArray(growable0);
    // exercise reverse-order block of addPolygonGrowableXYZArray
    builderG.toggleReversedFacetFlag();
    builderG.addPolygonGrowableXYZArray(growable1);

    const polyfaceG = builderG.claimPolyface(true);
    const totalAreaG = PolyfaceQuery.sumFacetAreas(polyfaceG);

    const builderP = PolyfaceBuilder.create();

    builderP.addPolygon(points0);
    // exercise reverse-order block of addPolygonGrowableXYZArray
    builderP.toggleReversedFacetFlag();
    builderP.addPolygon(points1);

    const polyfaceP = builderP.claimPolyface(true);
    const totalAreaP = PolyfaceQuery.sumFacetAreas(polyfaceG);

    ck.testCoordinate(totalAreaG, totalAreaP);
    ck.testCoordinate(2 * singleFacetArea, totalAreaP);

    ck.testCoordinate(2 * singleFacetArea, totalAreaG);
    const allGeometry: GeometryQuery[] = [];
    GeometryCoreTestIO.captureGeometry(allGeometry, polyfaceG, 0, 0, 0);
    GeometryCoreTestIO.captureGeometry(allGeometry, polyfaceP, 5, 0, 0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "addPolygon");
    expect(ck.getNumErrors()).equals(0);

  });

  it("Section", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    const zShift = 0.01;
    for (const multiplier of [1, 3]) {
      x0 += multiplier * 10;
      const polyface = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.unitX(), Vector3d.unitY(), 3 * multiplier, 4 * multiplier);
      if (multiplier > 1)
        polyface.data.point.mapComponent(2,
          (x: number, y: number, _z: number) => {
            return 1.0 * RFunctions.cosineOfMappedAngle(x, 0.0, 5.0) * RFunctions.cosineOfMappedAngle(y, -1.0, 8.0);
          });
      for (let q = 1; q <= multiplier + 1.5; q++) {
        const clipper = ClipPlane.createNormalAndPointXYZXYZ(q, 1, 0, q, q, 1)!;
        const section = PolyfaceClip.sectionPolyfaceClipPlane(polyface, clipper)!;
        // save with zShift to separate cleanly from the background mesh . .
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, section, x0, 0, zShift);
        GeometryCoreTestIO.captureGeometry(allGeometry, section, x0, 0, 0);
      }
      // !!! save this only at end so the x0 shift does not move the mesh for the clippers.
      GeometryCoreTestIO.captureGeometry(allGeometry, polyface, x0, 0, 0);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "Section");
    expect(ck.getNumErrors()).equals(0);

  });

  it("ClosedSection", () => {
    const ck = new Checker();
    let x0 = 0.0;
    const y0 = 0.0;
    const y1 = 10.0;
    const y2 = 20.0;
    const y3 = 30.0;
    const allGeometry: GeometryQuery[] = [];
    const xyStar = Sample.createStar(0, 0, 0, 4, 2, 4, true);
    // xyStar.reverse ();
    const sweep = LinearSweep.createZSweep(xyStar, 0, 10, true)!;
    const options = StrokeOptions.createForFacets();
    options.maxEdgeLength = 4.0;
    const builder = PolyfaceBuilder.create(options);
    builder.addLinearSweep(sweep);
    const facets = builder.claimPolyface(true);
    const range = facets.range();
    range.expandInPlace(0.5);
    for (const clipPlane of [
      ClipPlane.createNormalAndPointXYZXYZ(0, 0, 1, 1, 1, 3)!,
      ClipPlane.createNormalAndPointXYZXYZ(1, 0.5, 0.2, 0, 1, 1)!,
      ClipPlane.createNormalAndPointXYZXYZ(0, 1, 1, 1, 1, 2)!,
      ClipPlane.createNormalAndPointXYZXYZ(0, 0, 1, 0, 0, 2)!]) {
      for (const insideClip of [true, false]) {
        const clipPlanePoints = clipPlane.intersectRange(range)!;
        const frame = clipPlane.getFrame();
        const section = PolyfaceClip.sectionPolyfaceClipPlane(facets, clipPlane);
        const clippedPolyface = PolyfaceClip.clipPolyfaceClipPlaneWithClosureFace(facets, clipPlane, insideClip, true);
        const cutPlane = PolyfaceBuilder.polygonToTriangulatedPolyface(clipPlanePoints.getPoint3dArray());
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, facets, x0, y0, 0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutPlane, x0, y0, 0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, section, x0, y1, 0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, clippedPolyface, x0, y3, 0);
        for (const s of section) {
          if (s.isPhysicallyClosed) {
            const region = PolyfaceBuilder.polygonToTriangulatedPolyface(s.packedPoints.getPoint3dArray(), frame);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, region, x0, y2, 0);
          }
        }
        x0 += 10.0;
      }
      x0 += 30.0;
    }
    ck.testUndefined(PolyfaceBuilder.polygonToTriangulatedPolyface(
      [Point3d.create(0, 0), Point3d.create(0, 1)]), "should fail triangulating less than 3 points");
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "ClosedSection");
    expect(ck.getNumErrors()).equals(0);
  });
  it("Box", () => {
    const ck = new Checker();
    const builder = PolyfaceBuilder.create();
    builder.addBox(Box.createRange(Range3d.create(Point3d.create(-1, -1, -1), Point3d.create(1, 1, 1)), true)!);
    const facets = builder.claimPolyface();
    const range = facets.range();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const y0 = 0;
    for (const clipPlane of [
      ClipPlane.createNormalAndPointXYZXYZ(0, 0, 1, 0, 0, 0)!,
      ClipPlane.createNormalAndPointXYZXYZ(0, 0, -1, 0, 0, 0)!,
      ClipPlane.createNormalAndPointXYZXYZ(0, 2, 1, 0, 0, 0)!,
      ClipPlane.createNormalAndPointXYZXYZ(0, 2, -1, 0, 0, 0)!]) {
      const clipPlanePoints = clipPlane.intersectRange(range)!;
      const frame = clipPlane.getFrame();
      const dy = 2.0 * range.yLength();
      const y1 = y0 + dy;
      const y2 = y1 + dy;
      const y3 = y2 + dy;
      const section = PolyfaceClip.sectionPolyfaceClipPlane(facets, clipPlane);
      const clippedPolyface = PolyfaceClip.clipPolyfaceClipPlaneWithClosureFace(facets, clipPlane, true, true);
      const cutPlane = PolyfaceBuilder.polygonToTriangulatedPolyface(clipPlanePoints.getPoint3dArray());
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, facets, x0, y0, 0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutPlane, x0, y0, 0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, section, x0, y1, 0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, clippedPolyface, x0, y3, 0);
      for (const s of section) {
        if (s.isPhysicallyClosed) {
          const region = PolyfaceBuilder.polygonToTriangulatedPolyface(s.packedPoints.getPoint3dArray(), frame);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, region, x0, y2, 0);
        }
      }
      x0 += 10.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "Box");
    expect(ck.getNumErrors()).equals(0);
  });

  it("TwoComponentSection", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const meshJSON = {
      indexedMesh: {
        point: [
          [-1314.6730196637218, -57.10471794754267, -5.490003639162751], [-1314.896312748082, -56.537848295643926, -5.510317207634216], [-1314.8979232803686, -56.533829868771136, -5.3803893105941825],
          [-1314.6956910152803, -57.04815019853413, -3.662215652904706], [-1314.9189832430566, -56.48128271847963, -3.6825291425338946], [-1314.7091404076782, -57.0142579190433, -3.1975819905346725],
          [-1314.9231749525643, -56.47075137402862, -3.478972522978438], [-1314.9421641827794, -56.42276875022799, -3.0638822874461766], [-1314.7390657665092, -56.93854473717511, -2.7227602402563207],
          [-1314.976242534176, -56.336483863182366, -2.6424124827608466], [-1314.7866303779301, -56.81805418152362, -2.2439098892791662], [-1315.0262713459088, -56.209706934168935, -2.220409367873799],
          [-1314.834356342326, -56.69708855636418, -1.88633862361894], [-1314.8925853258697, -56.549456998705864, -1.5336732444993686], [-1315.0927135171369, -56.04125931020826, -1.8044034888444003],
          [-1314.961282182252, -56.37524692341685, -1.1892659660661593], [-1315.1755565702333, -55.831168909557164, -1.4013555171550252], [-1315.0402223932906, -56.17502646334469, -0.856507872173097],
          [-1315.274262645049, -55.58079734817147, -1.0183311252039857], [-1315.1289869659813, -55.949857488274574, -0.5387295018008444], [-1315.3580743367784, -55.368176135234535, -0.7483150090265553],
          [-1315.226965778158, -55.70128717646003, -0.2390975789166987], [-1315.4495686356095, -55.13604204170406, -0.4960487415373791], [-1315.333369733533, -55.431317169219255, 0.03948582641896792],
          [-1315.5479536699713, -54.88640406168997, -0.2638915148272645], [-1315.652313624567, -54.621586034074426, -0.05384081805823371], [-1315.4472513569053, -55.142351396381855, 0.2944752340845298],
          [-1319.4383521693526, -45.007064340636134, -5.923518669005716], [-1319.439963756071, -45.00304323993623, -5.793590867804596], [-1315.5675327406498, -54.83712511882186, 0.5237587880692445],
          [-1315.7989962851861, -54.249344075098634, 0.18917484689154662], [-1319.6616452540038, -44.440194689668715, -5.9438322374771815], [-1315.6930391303613, -54.518619729205966, 0.7257155363040511],
          [-1315.951936306432, -53.8611929519102, 0.3876608006248716], [-1315.8225359838107, -54.18996868748218, 0.8992497764993459], [-1316.1085139245843, -53.46378275100142, 0.5406269291997887],
          [-1315.9547671198961, -53.854360677301884, 1.043801223830087], [-1316.266183029511, -53.063577332533896, 0.6485063915024512], [-1316.0884916253272, -53.5149458842352, 1.1593317580409348],
          [-1316.4225866948836, -52.66656098328531, 0.7129976582655217], [-1319.4610235207947, -44.95049659349024, -4.095730682747671], [-1316.2225174400955, -53.17475076112896, 1.2462912875053007],
          [-1316.5756449538749, -52.27801544778049, 0.7368380023690406], [-1319.6843166055623, -44.38362694066018, -4.1160442512482405], [-1319.4593420174788, -44.95498723257333, -3.6845272506179754],
          [-1316.3997749281116, -52.72479889634997, 1.3193813897960354], [-1319.6824109015288, -44.388716329820454, -3.650013694772497], [-1319.4433784229914, -44.99574109353125, -3.2617125234392006],
          [-1316.5732409551856, -52.284447288140655, 1.3464004472771194], [-1319.411973949289, -45.07569708675146, -2.8325225476583], [-1319.6643188276794, -44.43490403983742, -3.1708236702834256],
          [-1317.2765918981167, -50.49853556416929, 0.6730709861731157], [-1319.3643031304819, -45.196947483345866, -2.4030360869364813], [-1319.6287270910107, -44.52552083041519, -2.6844083640899044],
          [-1319.2999650278944, -45.36050648894161, -1.979977705545025], [-1319.5899691355298, -44.62411019485444, -2.3189694250759203], [-1319.2190551686217, -45.56612777058035, -1.5704381284012925],
          [-1317.9176058679004, -48.871206316165626, 0.6147562326223124], [-1319.540610271506, -44.74960973486304, -1.9565164920932148], [-1319.1222068965435, -45.81219966430217, -1.1815293378895149],
          [-1318.0697283439804, -48.48499567061663, 0.5631527817167807], [-1319.039797498146, -46.02155460137874, -0.9074735297763254], [-1319.4806025013677, -44.90213949885219, -1.6004006100120023],
          [-1318.2241813773871, -48.09284638334066, 0.47038205052376725], [-1318.9497548320796, -46.250277870334685, -0.6514305796881672], [-1318.3788218617556, -47.70019774045795, 0.3340909504913725],
          [-1318.8192631817656, -46.58171500824392, -0.34194668068084866], [-1319.4100858065067, -45.08134227246046, -1.2540460220188834], [-1318.5312560963794, -47.3131257770583, 0.1530131880135741],
          [-1318.6789329773746, -46.93810682557523, -0.07282068848144263], [-1317.9351099316264, -48.82709795888513, 1.2225075878959615], [-1319.3293957076385, -45.286364460363984, -0.920851907460019],
          [-1318.1075154047576, -48.38939256221056, 1.164023675955832], [-1319.2390624813852, -45.51585812214762, -0.6040887353592552], [-1318.282562176406, -47.944956701248884, 1.0588835139351431],
          [-1319.139801532845, -45.76800546422601, -0.3067954441939946], [-1318.414131053025, -47.61089193448424, 0.9477621258411091], [-1319.032495127176, -46.040565280243754, -0.0316839705046732],
          [-1318.5446913255146, -47.2793722813949, 0.8081888991291635], [-1318.9181664104108, -46.330938938073814, 0.2189426910772454], [-1318.6730424726848, -46.95344530697912, 0.6399315853777807],
          [-1318.7979473226587, -46.63625187240541, 0.44325374250183813], [-1306.8970196380978, -54.03787715174258, -5.383082429820206], [-1307.1203127235058, -53.471007496118546, -5.403395998291671],
          [-1307.123446831596, -53.46758996602148, -5.273489050625358], [-1306.9411242355127, -53.98976263590157, -3.5555891540134326], [-1307.164416463871, -53.42289515584707, -3.575902643526206],
          [-1306.960030266142, -53.958022441715, -3.091030521376524], [-1307.1709969213116, -53.41330592986196, -3.372378869680688], [-1307.1948683849187, -53.36724884994328, -2.9573557656549383],
          [-1306.9955491531873, -53.884515340439975, -2.6162856828595977], [-1307.2339197730762, -53.282925319857895, -2.535954341001343], [-1307.0487732768524, -53.76625688839704, -2.137513151013991],
          [-1307.288944863947, -53.158118915744126, -2.1140199257060885], [-1307.100738369627, -53.64696316886693, -1.7800001740106381], [-1307.1631602107664, -53.50098526477814, -1.4273924473382067],
          [-1307.3603305587312, -52.991621006280184, -1.6980820209137164], [-1307.2359643492382, -53.32839509379119, -1.0830416447133757], [-1307.4479828339536, -52.783427353948355, -1.2951001767651178],
          [-1307.3188863100368, -53.129745027050376, -0.7503383005096111], [-1307.5512804948376, -52.53486670553684, -0.9121389198116958], [-1307.4114676423487, -52.90608137752861, -0.4326124111539684],
          [-1307.6383442233782, -52.32352809049189, -0.6421675197198056], [-1307.5130604805308, -52.65893642697483, -0.133030181779759], [-1307.7328908390482, -52.092597825452685, -0.3899432220205199],
          [-1307.6228408953757, -52.39029809460044, 0.1455067968054209], [-1307.834099994041, -51.84407367184758, -0.15782482747454196], [-1307.9410314990673, -51.58026986103505, 0.052190510177752],
          [-1307.7398305887473, -52.10255813319236, 0.4004534680279903], [-1311.6623521425645, -41.94022354390472, -5.816597459604964], [-1311.665487305203, -41.9368033381179, -5.686690607864875],
          [-1307.862925764406, -51.798441612161696, 0.6296983319043647], [-1308.090716930572, -51.209212188608944, 0.29516488648368977], [-1311.8856452268665, -41.373353890143335, -5.836911028047325],
          [-1307.9909314328688, -51.48092193715274, 0.8316207147436216], [-1308.2461448091199, -50.82204227428883, 0.4936166317493189], [-1308.1225989012164, -51.1531269820407, 1.0051251085824333],
          [-1308.4046809814172, -50.425404525361955, 0.6465558299678378], [-1308.2566640858422, -50.818242316134274, 1.1496513374440838], [-1308.5637816990493, -50.025763732381165, 0.7544156073709019],
          [-1308.3918843068532, -50.47941743209958, 1.2651613053458277], [-1308.7211074174847, -49.62911103852093, 0.8188941958360374], [-1311.7064567398047, -41.89210902992636, -3.98910418379819],
          [-1308.5270715028164, -50.13968035392463, 1.3521048656548373], [-1308.874608016049, -49.24073995836079, 0.8427284576755483], [-1311.9297498240485, -41.32523937523365, -4.009417752240552],
          [-1311.7095899169217, -41.89849856868386, -3.5779669542971533], [-1308.7053739842377, -49.69014063291252, 1.4251805990934372], [-1308.8793413292733, -49.249986744485795, 1.452192763419589],
          [-1311.6985617888859, -41.94119896925986, -3.1552200905571226], [-1311.933300757897, -41.3324808543548, -3.5434622254688293], [-1311.6721510011703, -42.023124465718865, -2.726098778686719],
          [-1309.575554959767, -47.461260076612234, 0.7789614414214157], [-1311.920802212495, -41.38087464310229, -3.0643491127702873], [-1311.6294600100373, -42.14633889589459, -2.296680791361723],
          [-1311.8908699883032, -41.473723533563316, -2.578011625824729], [-1311.5700086812722, -42.31182523816824, -1.873689603904495], [-1311.8563511604443, -41.57398480270058, -2.21263097555493],
          [-1311.4938095906982, -42.51930443570018, -1.464214800595073], [-1310.2165689287358, -45.83393083047122, 0.7206466880161315], [-1311.8111851541325, -41.70113799907267, -1.8502356949611567],
          [-1311.4014134522877, -42.76713224314153, -1.0753672275459394], [-1310.3682490662322, -45.447545723989606, 0.6690493192581926], [-1311.3221262866864, -42.97771858703345, -0.801354350609472],
          [-1311.755284666433, -41.85528766736388, -1.494176288601011], [-1310.5217800466344, -45.05503278132528, 0.5762912663631141], [-1311.2349867338198, -43.207586833275855, -0.5453513188112993],
          [-1310.6749889180646, -44.66181951202452, 0.44001985117211007], [-1311.1079810556257, -43.54039883520454, -0.23591535238665529], [-1310.8254645981942, -44.27397509943694, 0.2589690191671252],
          [-1310.9706536214217, -43.89797494281083, 0.03316935116890818], [-1311.6887497214484, -42.03606083616614, -1.1478764503262937], [-1310.2412103049573, -45.79263741709292, 1.3282999040384311],
          [-1311.6118763824343, -42.24258834775537, -0.814734816813143], [-1310.413114460418, -45.35473429784179, 1.2698228852823377], [-1311.5251571819535, -42.47350737452507, -0.4980213381059002],
          [-1310.5871162380208, -44.90988629497588, 1.1646970921137836], [-1311.42927269364, -42.72698638681322, -0.200774473749334], [-1310.7175237335614, -44.575363480485976, 1.053591673146002],
          [-1311.3250743568642, -43.00077202171087, 0.07429426346789114], [-1310.8465882905875, -44.24325392302126, 0.9140390128304716], [-1311.2135594324209, -43.29225543513894, 0.3248822349414695],
          [-1310.9731053883443, -43.91660360060632, 0.7458069174608681], [-1311.0958396244678, -43.59855407383293, 0.5491589208832011]],
        pointIndex: [84, 83, 1, 2, 0, 83, 86, 4, 1, 0, 86, 88, 6, 4, 0, 88, 91, 9, 6, 0, 91, 93, 11, 9, 0, 93, 95, 13, 11, 0, 95, 96, 14, 13, 0, 96, 98, 16, 14, 0, 98, 100, 18, 16, 0, 100, 102, 20, 18, 0,
          102, 104, 22, 20, 0, 104, 106, 24, 22, 0, 106, 109, 27, 24, 0, 109, 112, 30, 27, 0, 112, 115, 33, 30, 0, 115, 117, 35, 33, 0, 117, 119, 37, 35, 0, 119, 121, 39, 37, 0, 121, 124, 42, 39, 0,
          124, 128, 46, 42, 0, 128, 129, 49, 46, 0, 129, 153, 71, 49, 0, 153, 155, 73, 71, 0, 155, 157, 75, 73, 0, 157, 159, 77, 75, 0, 159, 161, 79, 77, 0, 161, 163, 81, 79, 0, 163, 164, 82, 81, 0,
          164, 162, 80, 82, 0, 162, 160, 78, 80, 0, 160, 158, 76, 78, 0, 158, 156, 74, 76, 0, 156, 154, 72, 74, 0, 154, 152, 68, 72, 0, 152, 145, 63, 68, 0, 145, 141, 59, 63, 0, 141, 138, 56, 59, 0,
          138, 136, 54, 56, 0, 136, 134, 51, 54, 0, 134, 131, 47, 51, 0, 131, 126, 44, 47, 0, 126, 114, 32, 44, 0, 114, 110, 28, 32, 0, 110, 111, 29, 28, 0, 111, 123, 41, 29, 0, 123, 127, 45, 41, 0,
          127, 130, 48, 45, 0, 130, 132, 50, 48, 0, 132, 135, 53, 50, 0, 135, 137, 55, 53, 0, 137, 139, 57, 55, 0, 139, 142, 60, 57, 0, 142, 144, 62, 60, 0, 144, 147, 65, 62, 0, 147, 149, 67, 65, 0,
          149, 151, 70, 67, 0, 151, 150, 69, 70, 0, 150, 148, 66, 69, 0, 148, 146, 64, 66, 0, 146, 143, 61, 64, 0, 143, 140, 58, 61, 0, 140, 133, 52, 58, 0, 133, 125, 43, 52, 0, 125, 122, 40, 43, 0,
          122, 120, 38, 40, 0, 120, 118, 36, 38, 0, 118, 116, 34, 36, 0, 116, 113, 31, 34, 0, 113, 108, 26, 31, 0, 108, 107, 25, 26, 0, 107, 105, 23, 25, 0, 105, 103, 21, 23, 0, 103, 101, 19, 21, 0,
          101, 99, 17, 19, 0, 99, 97, 15, 17, 0, 97, 94, 12, 15, 0, 94, 92, 10, 12, 0, 92, 90, 8, 10, 0, 90, 89, 7, 8, 0, 89, 87, 5, 7, 0, 87, 85, 3, 5, 0, 85, 84, 2, 3, 0,
          2, 1, 4, 6, 9, 11, 13, 14, 16, 18, 20, 22, 24, 27, 30, 33, 35, 37, 39, 42, 46, 49, 71, 73, 75, 77, 79, 81, 82, 80, 78, 76, 74, 72, 68, 63, 59, 56, 54, 51, 47, 44, 32, 28, 29, 41, 45, 48, 50, 53, 55, 57, 60, 62, 65, 67, 70, 69, 66, 64, 61, 58, 52, 43, 40, 38, 36, 34, 31, 26, 25, 23, 21, 19, 17, 15, 12, 10, 8, 7, 5, 3, 0,
          // start split face
          // 73, 75, 77, 79, 81, 82, 80, 78, 76, 74, 72, 68, 63, 59, 56, 54, 51, 47, 44, 32, 28, 29, 41, 45, 48, 50, 53, 55, 57, 60, 62, 65, 67, 70, 69, 66, 64, 61, 58, 0,
          // 58, 52, 43, 40, 38, 36, 34, 31, 26, 25, 23, 21, 19, 17, 15, 12, 10, 8, 7, 5, 3, 2, 1, 4, 6, 9, 11, 13, 14, 16, 18, 20, 22, 24, 27, 30, 33, 35, 37, 39, 42, 46, 49, 71, 73, 0,
          // end split face
          85, 83, 84, 0, 85, 86, 83, 0, 89, 88, 86, 0, 90, 91, 88, 0, 92, 93, 91, 0, 94, 95, 93, 0, 97, 96, 95, 0, 97, 98, 96, 0, 99, 100, 98, 0, 101, 102, 100, 0, 103, 104, 102, 0,
          105, 106, 104, 0, 107, 109, 106, 0, 108, 112, 109, 0, 113, 115, 112, 0, 113, 117, 115, 0, 116, 119, 117, 0, 118, 121, 119, 0, 120, 124, 121, 0, 120, 128, 124, 0, 122, 129, 128, 0,
          133, 153, 129, 0, 143, 155, 153, 0, 146, 157, 155, 0, 146, 159, 157, 0, 148, 161, 159, 0, 150, 163, 161, 0, 151, 164, 163, 0, 151, 162, 164, 0, 149, 160, 162, 0, 147, 158, 160, 0,
          144, 156, 158, 0, 142, 154, 156, 0, 139, 152, 154, 0, 139, 145, 152, 0, 137, 141, 145, 0, 135, 138, 141, 0, 132, 136, 138, 0, 130, 134, 136, 0, 127, 131, 134, 0, 123, 126, 131, 0,
          111, 114, 126, 0, 111, 110, 114, 0, 126, 123, 111, 0, 131, 127, 123, 0, 134, 130, 127, 0, 136, 132, 130, 0, 138, 135, 132, 0, 141, 137, 135, 0, 145, 139, 137, 0, 154, 142, 139, 0,
          156, 144, 142, 0, 158, 147, 144, 0, 160, 149, 147, 0, 162, 151, 149, 0, 163, 150, 151, 0, 161, 148, 150, 0, 159, 146, 148, 0, 155, 143, 146, 0, 153, 140, 143, 0, 153, 133, 140, 0,
          129, 125, 133, 0, 129, 122, 125, 0, 128, 120, 122, 0, 121, 118, 120, 0, 119, 116, 118, 0, 117, 113, 116, 0, 112, 108, 113, 0, 109, 107, 108, 0, 106, 105, 107, 0, 104, 103, 105, 0,
          102, 101, 103, 0, 100, 99, 101, 0, 98, 97, 99, 0, 95, 94, 97, 0, 93, 92, 94, 0, 91, 90, 92, 0, 88, 89, 90, 0, 86, 87, 89, 0, 86, 85, 87, 0],
      },
    };
    const clipPlane = ClipPlane.createNormalAndDistance(Vector3d.create(-0.012396820892038292, 0.030931559524568275, 0.9994446245076056), 13.05715711957438)!;

    const polyface = IModelJson.Reader.parse(meshJSON);
    if (ck.testDefined(polyface) && polyface instanceof Polyface) {
      const point0 = polyface.data.point.getPoint3dAtUncheckedPointIndex(0);
      const x0 = -point0.x;
      let y0 = -point0.y;
      const z0 = -point0.z;
      const dy = Math.max(5.0, polyface.range().yLength() + 1);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, x0, y0, z0);
      for (const inside of [true, false]) {
        const clippedPolyface = PolyfaceClip.clipPolyfaceClipPlaneWithClosureFace(polyface, clipPlane, inside, true);
        y0 += dy;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, clippedPolyface, x0, y0, z0);
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "TwoComponentSection");
    expect(ck.getNumErrors()).equals(0);
  });

  it("UnderAndOver", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    for (const numX of [2, 5, 10]) {
      for (const numY of [2, 4, 15]) {
        for (const mapY of [false, true]) {
          y0 = 0;
          const yStep = numY + 1;
          GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(Point3d.create(x0, y0), Point3d.create(x0, y0 + yStep)));
          GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(Point3d.create(x0, y0 + yStep), Point3d.create(x0, y0 + 2 * yStep)));
          const meshX = Sample.createTriangularUnitGridPolyface(Point3d.create(0.1, 0.2, -0.5), Vector3d.create(0.5, 0, 0.3), Vector3d.create(0, 0.6, 0), numX, numY);
          if (mapY)
            meshX.data.point.mapComponent(2,
              (x: number, y: number, _z: number) => {
                return 1.0 * RFunctions.cosineOfMappedAngle(x, 0.0, 5.0) * RFunctions.cosineOfMappedAngle(y, -1.0, 8.0);
              });
          const meshY = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.unitX(), Vector3d.unitY(), numX, numY);
          /*
          let z0 = 0.125;
          const builderY = PolyfaceBuilder.create();
          builderY.addPolygon([Point3d.create(0, 0, z0), Point3d.create(2, 0, z0), Point3d.create(2, 2, z0), Point3d.create(0, 2, z0)]);
          const meshY = builderY.claimPolyface();
           */
          if (mapY)
            meshY.data.point.mapComponent(2,
              (x: number, y: number, _z: number) => {
                return 1.0 * RFunctions.cosineOfMappedAngle(x, 0.0, 3.0) * RFunctions.cosineOfMappedAngle(y, -1.0, 5.0);
              });
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshX, x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshY, x0, y0);
          const visitorX = meshX.createVisitor();
          const visitorY = meshY.createVisitor();
          const builderXUnderY = PolyfaceBuilder.create();
          const builderXOverY = PolyfaceBuilder.create();
          PolyfaceClip.clipPolyfaceUnderOverConvexPolyfaceIntoBuilders(visitorX, visitorY, builderXUnderY, builderXOverY);
          const builderYUnderX = PolyfaceBuilder.create();
          const builderYOverX = PolyfaceBuilder.create();
          PolyfaceClip.clipPolyfaceUnderOverConvexPolyfaceIntoBuilders(visitorY, visitorX, builderYUnderX, builderYOverX);

          y0 += yStep;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, builderXUnderY.claimPolyface(), x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, builderXOverY.claimPolyface(), x0, y0);
          y0 += yStep;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, builderYUnderX.claimPolyface(), x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, builderYOverX.claimPolyface(), x0, y0);
          y0 += yStep;
          const cutFill = PolyfaceClip.computeCutFill(meshX, meshY);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutFill.meshAUnderB, x0, y0);
          y0 += yStep;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutFill.meshAOverB, x0, y0);
          y0 += 2 * yStep;
          const fixA = PolyfaceQuery.cloneWithTVertexFixup(cutFill.meshAOverB);
          const fixB = PolyfaceQuery.cloneWithTVertexFixup(cutFill.meshAUnderB);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, fixA, x0, y0);
          y0 += yStep;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, fixB, x0, y0);
          y0 += 2 * yStep;
          const fixEdgeA = PolyfaceQuery.cloneWithColinearEdgeFixup(fixA);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, fixEdgeA, x0, y0);
          y0 += yStep;
          const fixEdgeB = PolyfaceQuery.cloneWithColinearEdgeFixup(fixB);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, fixEdgeB, x0, y0);
          y0 += yStep;

          x0 += numX * 2 + 4;
        }
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "UnderAndOver");
    expect(ck.getNumErrors()).equals(0);

  });

  it("NonConvexClip", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    const deltaX = 10.0;
    const gapDelta = 1.0;
    // plane+polygon clip with at-vertex and nonconvex cases
    const shape0 = GrowableXYZArray.create([[0, 0], [0, 6], [4, 4]]);
    const shape1 = GrowableXYZArray.create([[0, 0], [0, 6], [4, 4], [2, 1]]);
    const shape2 = GrowableXYZArray.create([[0, 0], [0, 6], [4, 6], [4, 0]]);
    const shape3 = GrowableXYZArray.create([[0, 0], [0, 6], [4, 4], [4, 0], [3, 0], [3, 2], [1, 3], [1, 0]]);
    const shape4 = GrowableXYZArray.create([[0, 0], [0, 6], [4, 4], [4, 0], [3, 0], [3, 2], [1, 2], [1, 0], [0.5, 0], [0.5, 2], [0.25, 2], [0.25, 0]]);
    const shape5 = GrowableXYZArray.create(Sample.createSquareWave(Point3d.create(0, 0, 0), 0.5, 3, 0.75, 3, 4));
    for (const points of [shape5, shape0, shape1, shape2, shape3, shape4, shape5]) {
      const range = Range3d.createFromVariantData(points);
      range.expandInPlace(1.5);
      range.high.z = range.low.z;

      const work = new GrowableXYZArray();
      GeometryCoreTestIO.createAndCaptureLoop(allGeometry, points, x0, y0);
      for (const y of [2, 0, 1, 2, 3, 4, 5, 6]) {
        const plane = Plane3dByOriginAndUnitNormal.create(Point3d.create(0, y, 0), Vector3d.create(0, 1, 0))!;
        GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.createXYXY(-2, y, 22, y), x0, y0);
        x0 += deltaX;
        const pointsA = points.clone();
        const numCrossingsA = IndexedXYZCollectionPolygonOps.clipConvexPolygonInPlace(plane, pointsA, work, false);
        const loopsA = IndexedXYZCollectionPolygonOps.gatherCutLoopsFromPlaneClip(plane, pointsA);
        GeometryCoreTestIO.createAndCaptureLoop(allGeometry, pointsA, x0, y0);

        for (const loop of loopsA.inputLoops)
          GeometryCoreTestIO.createAndCaptureLoop(allGeometry, loop.xyz, x0 + 10.0, y0);
        IndexedXYZCollectionPolygonOps.reorderCutLoops(loopsA);
        for (const loop of loopsA.outputLoops)
          GeometryCoreTestIO.createAndCaptureLoop(allGeometry, loop.xyz, x0 + 20.0, y0);

        const pointsB = points.clone();
        const numCrossingsB = IndexedXYZCollectionPolygonOps.clipConvexPolygonInPlace(plane, pointsB, work, true);
        const loopsB = IndexedXYZCollectionPolygonOps.gatherCutLoopsFromPlaneClip(plane, pointsB);
        GeometryCoreTestIO.createAndCaptureLoop(allGeometry, pointsB, x0, y0 + gapDelta);
        for (const loop of loopsB.inputLoops)
          GeometryCoreTestIO.createAndCaptureLoop(allGeometry, loop.xyz, x0 + 10, y0 + gapDelta);
        IndexedXYZCollectionPolygonOps.reorderCutLoops(loopsB);
        for (const loop of loopsB.outputLoops)
          GeometryCoreTestIO.createAndCaptureLoop(allGeometry, loop.xyz, x0 + 20.0, y0 + gapDelta);

        if (((numCrossingsB !== 0 && numCrossingsB !== 2)) || (numCrossingsA !== 0 && numCrossingsA !== 2))
          GeometryCoreTestIO.captureRangeEdges(allGeometry, range, x0, y0);
        ck.testExactNumber(numCrossingsA, numCrossingsB, "crossing counts with inside flip");
        x0 += 40.0;
      }
      y0 += 25.0;
      x0 = 0.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "NonConvexClip");
    expect(ck.getNumErrors()).equals(0);
  });

  it("CutFill", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    let y0 = 0;
    const numXA = 6;
    const numYA = 5;
    const numXB = 8;
    const numYB = 8;
    const meshA = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.unitX(), Vector3d.unitY(), numXA, numYA);
    const amplitudeA = 0.2;
    const amplitudeB = -0.35;
    meshA.data.point.mapComponent(2,
      (x: number, y: number, _z: number) => {
        return amplitudeA * RFunctions.cosineOfMappedAngle(x, 0.0, numXA) * RFunctions.cosineOfMappedAngle(y, 0, numYA);
      });

    const meshB = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.unitX(0.4), Vector3d.unitY(0.3), numXB, numYB);
    meshB.data.point.mapComponent(2,
      (x: number, y: number, _z: number) => {
        return amplitudeB * RFunctions.cosineOfMappedAngle(x, 0.0, 3.0) * RFunctions.cosineOfMappedAngle(y, 1, 5.0);
      });
    // spin meshB so its grids do not align with mesh A
    const transform = Transform.createFixedPointAndMatrix(Point3d.create(0, numYB / 2, 0), Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(30)));
    meshB.tryTransformInPlace(transform);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshA, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshB, x0, y0);
    const cutFill = PolyfaceClip.computeCutFill(meshA, meshB);

    y0 -= numYA;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutFill.meshAUnderB, x0, y0);
    y0 -= numYA;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutFill.meshAOverB, x0, y0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "CutFill");
    expect(ck.getNumErrors()).equals(0);

  });
  // cspell:word Arnoldas
  it("ArnoldasBox", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const meshData = {
      indexedMesh: {
        point: [
          [0, 0, 0.4999999999723128],
          [0, 0, 1], [2.3283064365386963e-10, 0.6889561647549272, 0.49999999998019096],
          [0.8495529009960592, 9.313225746154785e-10, 0.5000000000207994],

          [0.3110438375733793, 0.6889561647549272, 0.499999999997943],
          [0.8495529009960592, 0.15044710040092468, 0.5000000000225198],
          [4.656612873077393e-10, 0.6889561638236046, 1],
          [0.8495529008796439, 9.313225746154785e-10, 1],

          [0.8495529012288898, 0.6889561638236046, 0.5000000000286775],
          [0.8495529012288898, 0.6889561638236046, 0.8908151873411514],
          [0.8495529012288898, 0.6889561638236046, 1]],
        pointIndex: [1, 4, 8, 2, 0, 3, 1, 2,
          7, 0, 11, 7, 2, 8, 0, 3,
          5, 6, 4, 1, 0, 6, 5, 9,
          0,
          9, 5, 10, 0, 5, 3, 7, 0,
          7, 11, 10, 5, 0, 4, 6, 8,
          0,
          6, 9, 10, 0, 10, 11, 8, 0,
          8, 6, 10, 0],
      },
    };
    let x0 = 0;
    let y0 = 0;
    const yStep = 2.0;
    const xStep = 5.0;
    const polyface = IModelJson.Reader.parse(meshData);
    const vectorA = Vector3d.create(-1, -1, -0.234);
    vectorA.normalizeInPlace();
    if (ck.testDefined(polyface) && ck.testTrue(polyface instanceof Polyface) && polyface instanceof Polyface) {
      for (const transform of Sample.createRigidTransforms(1.0)) {
        y0 = 0.0;
        for (const clipPlane of [ClipPlane.createNormalAndDistance(Vector3d.create(0, 0, -1), -0.8221099398657934)!,
          /* */ ClipPlane.createNormalAndDistance(Vector3d.create(0, -1, 0), -0.4221099398657934)!,
          /* */ ClipPlane.createNormalAndDistance(Vector3d.create(-1, 0, 0), -0.8221099398657934)!,
          /* */ ClipPlane.createNormalAndDistance(vectorA, -0.8221099398657934)!]) {
          const clipPlaneA = clipPlane.clone();
          clipPlaneA.transformInPlace(transform);
          const polyfaceA = polyface.cloneTransformed(transform) as Polyface;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyfaceA, x0, y0);
          for (const inside of [false, true]) {
            const clip = PolyfaceClip.clipPolyfaceClipPlaneWithClosureFace(polyfaceA, clipPlaneA, inside, true);
            if (ck.testDefined(clip) && clip) {
              ck.testTrue(PolyfaceQuery.isPolyfaceClosedByEdgePairing(clip), " clip closure");
              GeometryCoreTestIO.captureCloneGeometry(allGeometry, clip, x0, y0 += yStep);
            }
          }
          y0 += 5 * yStep;
        }
        x0 += xStep;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "ArnoldasBox");
    expect(ck.getNumErrors()).equals(0);

  });

  it("CutFill", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const sideAngle = Angle.createDegrees(0.001);
    const meshA = IModelJson.Reader.parse(JSON.parse(fs.readFileSync("./src/test/iModelJsonSamples/polyface/ArnoldasEarthWorks/meshA.imjs", "utf8")));
    if (ck.testTrue(meshA instanceof IndexedPolyface, "Expected one indexed polyface in meshA") && meshA instanceof IndexedPolyface) {
      ck.testFalse(PolyfaceQuery.isPolyfaceClosedByEdgePairing(meshA), " expect this input to have boundary issue");
      const boundaries = PolyfaceQuery.boundaryEdges(meshA, true, true, true);
      const range = meshA.range();
      const rv = raggedVolume(meshA);
      console.log("Volume estimate", rv);

      const dz = range.zLength() * 2.0;
      const dzFront = 4 * dz;
      const dzSide = 3 * dz;
      const dzRear = 2 * dz;
      const dx = 2.0 * range.xLength();
      const x1 = dx;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshA, 0, 0);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, 0, 0, 0);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, 0, 0, dz);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, 0, 0, dzFront);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, 0, 0, dzSide);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, 0, 0, dzRear);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, boundaries, 0, 0, dz);

      const partitionedIndices = PolyfaceQuery.partitionFacetIndicesByVisibilityVector(meshA, Vector3d.unitZ(), sideAngle);
      const meshes = PolyfaceQuery.clonePartitions(meshA, partitionedIndices);
      GeometryCoreTestIO.captureRangeEdges(allGeometry, range, 0, 0, dzFront);
      PolyfaceQuery.markPairedEdgesInvisible(meshes[0] as IndexedPolyface, Angle.createDegrees(5));
      PolyfaceQuery.markPairedEdgesInvisible(meshes[1] as IndexedPolyface, Angle.createDegrees(5));

      GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshes[0], 0, 0, dzFront);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshes[2], 0, 0, dzSide);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshes[1], 0, 0, dzRear);
      const front = meshes[0] as IndexedPolyface;
      const rear = meshes[1] as IndexedPolyface;
      rear.reverseIndices();
      const cutFill = PolyfaceClip.computeCutFill(front, rear);

      GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutFill.meshAUnderB, x1, 0, 0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutFill.meshAOverB, x1, 0, dz);

      GeometryCoreTestIO.saveGeometry(allGeometry, "ArnoldasEarthWorks", "meshA");
    }
    expect(ck.getNumErrors()).equals(0);

  });

});
/** Estimate a volume for a mesh that may be missing side faces.
 * * Compute volume "between" the mesh facets and the bottom plane of the mesh range
 * * Compute volume "between" the mesh facets and the top plane of the mesh range.
 * * The return structure contains
 *    * a volume estimate
 *    * a relative error estimate based on the difference between upper and lower volumes.
 *
 */
function raggedVolume(mesh: Polyface): { volume: number, volumeDifferenceRelativeError: number } {
  const range = mesh.range();
  const xyPlane0 = Plane3dByOriginAndUnitNormal.createXYPlane(range.low);
  const xyPlane1 = Plane3dByOriginAndUnitNormal.createXYPlane(range.high);
  const volume0 = PolyfaceQuery.sumVolumeBetweenFacetsAndPlane(mesh, xyPlane0);
  const volume1 = PolyfaceQuery.sumVolumeBetweenFacetsAndPlane(mesh, xyPlane1);
  const volumeDifference = Math.abs(volume1.volume - volume0.volume);
  return { volume: volume0.volume, volumeDifferenceRelativeError: Geometry.safeDivideFraction(volumeDifference, Math.abs(volume0.volume), 1000.0) };
}
