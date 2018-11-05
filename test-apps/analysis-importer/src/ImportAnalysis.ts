/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelDb, IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { GeometryStreamBuilder, GeometryStreamProps, Gradient, Code, GeometricElement3dProps, ViewFlags, ColorDef, RenderMode } from "@bentley/imodeljs-common";
import { Id64String } from "@bentley/bentleyjs-core";
import { OpenMode } from "@bentley/bentleyjs-core";
import { Angle, Polyface, IModelJson, AuxChannelDataType, AuxChannel, PolyfaceBuilder, Point3d, StrokeOptions, AuxChannelData, PolyfaceAuxData } from "@bentley/geometry-core";
import { Utilities, KnownTestLocations, AnalysisStyleProps } from "./Utilities";
import * as path from "path";
import { readFileSync } from "fs";

/** Create a geometry stream from a Polyface. */
function generateGeometryStreamFromPolyface(polyface: Polyface): GeometryStreamProps {
    const builder = new GeometryStreamBuilder();

    builder.appendGeometry(polyface);

    return builder.geometryStream;
}

/**  get [[AnalysisStyles] for a polyface.  This is just an example - it pairs displacement and scalar channels that have matching input names */
function getPolyfaceAnalysisStyleProps(polyface: Polyface): AnalysisStyleProps[] {
    const analysisStyleProps: AnalysisStyleProps[] = [];
    if (undefined === polyface.data.auxData)
        return analysisStyleProps;

    /**  Create a mapping from input name to channel - this is used to pair the displacement and scalar channels. */
    const displacementChannels: Map<string, AuxChannel> = new Map<string, AuxChannel>();

    for (const channel of polyface.data.auxData.channels)
        if (channel.dataType === AuxChannelDataType.Vector)
            displacementChannels.set(channel.inputName!, channel);

    for (const channel of polyface.data.auxData.channels) {
        if (channel.isScalar) {
            const thematicSettings = new Gradient.ThematicSettings();
            const displacementChannel = displacementChannels.get(channel.inputName!);
            /**  If this channel ends with "Height" assign it a "Sea to Mountain" Gradient rather than the default (green-red) gradient. */
            if (channel.name && channel.name.endsWith("Height")) {
                thematicSettings.colorScheme = Gradient.ThematicColorScheme.SeaMountain;
                thematicSettings.mode = Gradient.ThematicMode.SteppedWithDelimiter;
            }
            /** create the [[AnalysisStyle]] and add to the array. */
            analysisStyleProps.push({
                displacementChannelName: displacementChannel ? displacementChannel.name : undefined,
                scalarRange: channel.scalarRange,
                scalarChannelName: channel.name,
                scalarThematicSettings: thematicSettings,
                inputName: channel.inputName,
            });
        }
    }
    return analysisStyleProps;
}
/** Create an analysis model for a [[Polyface]] with [[PolyfaceAuxData]] and [[DisplayStyles]] for viewing the [[AuxChannels]] */
async function createAnalysisModel(polyface: any, categoryId: Id64String, modelName: string, iModel: IModelDb) {
    if (!(polyface instanceof Polyface))
        return;
    const modelId = await Utilities.createModel(iModel, modelName);

    const geometry = generateGeometryStreamFromPolyface(polyface);
    const analysisStyleProps = getPolyfaceAnalysisStyleProps(polyface);
    const viewFlags = new ViewFlags();
    const backgroundColor = ColorDef.white;

    viewFlags.renderMode = RenderMode.SolidFill;        // SolidFill rendering ... no lighting etc.

    const props: GeometricElement3dProps = {
        model: modelId,
        code: Code.createEmpty(),
        classFullName: "Generic: PhysicalObject",
        category: categoryId,
        geom: geometry,
    };
    await iModel.elements.insertElement(props);

    let first = true;
    for (const analysisStyleProp of analysisStyleProps) {
        let name = analysisStyleProp.scalarChannelName!;
        if (undefined !== analysisStyleProp.displacementChannelName)
            name = name + " and " + analysisStyleProp.displacementChannelName;
        const displayStyleId = Utilities.createAndInsertDisplayStyle3d(iModel, name + "Style", viewFlags, backgroundColor, analysisStyleProp);
        const viewId = Utilities.createOrthographicView(iModel, name + " View", modelId, categoryId, polyface.range(), displayStyleId);
        if (first) {
            first = false;
            Utilities.setDefaultViewId(iModel, viewId);
        }
    }
}
/** Import a polyface from the supplied json file. */
async function importPolyfaceFromJson(jsonFileName: string) {
    const jsonString = readFileSync(path.join(KnownTestLocations.assetsDir, jsonFileName), "utf8");
    const json = JSON.parse(jsonString);
    return IModelJson.Reader.parse(json);
}
/** Create a polyface representing a cantilever beam with [[PolyfaceAuxData]] representing the stress and deflection. */
function createFlatMeshWithWaves() {
    const options = StrokeOptions.createForFacets();
    options.shouldTriangulate = true;
    const builder = PolyfaceBuilder.create(options);
    const nDimensions = 100;
    const spacing = 1.0;

    for (let iRow = 0; iRow < nDimensions - 1; iRow++) {
        for (let iColumn = 0; iColumn < nDimensions - 1; iColumn++) {
            const quad = [Point3d.create(iRow * spacing, iColumn * spacing, 0.0),
            Point3d.create((iRow + 1) * spacing, iColumn * spacing, 0.0),
            Point3d.create((iRow + 1) * spacing, (iColumn + 1) * spacing, 0.0),
            Point3d.create(iRow * spacing, (iColumn + 1) * spacing)];
            builder.addQuadFacet(quad);
        }
    }

    const polyface = builder.claimPolyface();
    const zeroScalarData = [], zeroDisplacementData = [], radialHeightData = [], radialSlopeData = [], radialDisplacementData = [];
    const radius = nDimensions * spacing / 2.0;
    const center = new Point3d(radius, radius, 0.0);
    const maxHeight = radius / 4.0;
    const auxChannels = [];

    /** Create a radial wave - start and return to zero */
    for (let i = 0; i < polyface.data.point.length; i++) {
        const angle = Angle.pi2Radians * polyface.data.point.distanceIndexToPoint(i, center) / radius;
        const height = maxHeight * Math.sin(angle);
        const slope = Math.abs(Math.cos(angle));

        zeroScalarData.push(0.0);
        zeroDisplacementData.push(0.0);
        zeroDisplacementData.push(0.0);
        zeroDisplacementData.push(0.0);

        radialHeightData.push(height);
        radialSlopeData.push(slope);
        radialDisplacementData.push(0.0);
        radialDisplacementData.push(0.0);
        radialDisplacementData.push(height);
    }

    const radialDisplacementDataVector = [new AuxChannelData(0.0, zeroDisplacementData), new AuxChannelData(1.0, radialDisplacementData), new AuxChannelData(2.0, zeroDisplacementData)];
    const radialHeightDataVector = [new AuxChannelData(0.0, zeroScalarData), new AuxChannelData(1.0, radialHeightData), new AuxChannelData(2.0, zeroScalarData)];
    const radialSlopeDataVector = [new AuxChannelData(0.0, zeroScalarData), new AuxChannelData(1.0, radialSlopeData), new AuxChannelData(2.0, zeroScalarData)];

    auxChannels.push(new AuxChannel(radialDisplacementDataVector, AuxChannelDataType.Vector, "Radial Displacement", "Radial: Time"));
    auxChannels.push(new AuxChannel(radialHeightDataVector, AuxChannelDataType.Distance, "Radial Height", "Radial: Time"));
    auxChannels.push(new AuxChannel(radialSlopeDataVector, AuxChannelDataType.Scalar, "Radial Slope", "Radial: Time"));

    const waveHeight = radius / 20.0;
    const waveLength = radius / 2.0;
    const frameCount = 10;
    const linearDisplacementDataVector = [], linearHeightDataVector = [], linearSlopeDataVector = [];

    for (let i = 0; i < frameCount; i++) {
        const fraction = i / (frameCount - 1);
        const waveCenter = waveLength * fraction;
        const linearHeightData = [], linearSlopeData = [], linearDisplacementData = [];

        for (let j = 0; j < polyface.data.point.length; j++) {
            const point = polyface.data.point.getPoint3dAt(j);
            const theta = Angle.pi2Radians * (point.x - waveCenter) / waveLength;
            const height = waveHeight * Math.sin(theta);
            const slope = Math.abs(Math.cos(theta));

            linearHeightData.push(height);
            linearSlopeData.push(slope);
            linearDisplacementData.push(0.0);
            linearDisplacementData.push(0.0);
            linearDisplacementData.push(height);
        }
        linearDisplacementDataVector.push(new AuxChannelData(i, linearDisplacementData));
        linearHeightDataVector.push(new AuxChannelData(i, linearHeightData));
        linearSlopeDataVector.push(new AuxChannelData(i, linearSlopeData));
    }
    auxChannels.push(new AuxChannel(linearDisplacementDataVector, AuxChannelDataType.Vector, "Linear Displacement", "Linear: Time"));
    auxChannels.push(new AuxChannel(linearHeightDataVector, AuxChannelDataType.Distance, "Linear Height", "Linear: Time"));
    auxChannels.push(new AuxChannel(linearSlopeDataVector, AuxChannelDataType.Scalar, "Linear Slope", "Linear: Time"));

    polyface.data.auxData = new PolyfaceAuxData(auxChannels, polyface.data.pointIndex);

    return polyface;
}

async function doAnalysisExamples() {
    const config = new IModelHostConfiguration();
    IModelHost.startup(config);

    const iModel: IModelDb = Utilities.openIModel("empty.bim", { copyFilename: "AnalysisExample.bim", deleteFirst: true, openMode: OpenMode.ReadWrite });
    if (!iModel)
        return;

    const categoryId = await Utilities.createAndInsertSpatialCategory(iModel, "Analysis Category");
    const importedPolyface = await importPolyfaceFromJson("RadialWave.json");

    if (false)
        await createAnalysisModel(importedPolyface, categoryId, "Imported Data", iModel);

    const flatWaveMesh = createFlatMeshWithWaves();

    await createAnalysisModel(flatWaveMesh, categoryId, "Cantiliever Beam", iModel);

    iModel.saveChanges();
    iModel.closeStandalone();
}

doAnalysisExamples();
