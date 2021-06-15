/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { readFileSync } from "fs";
import * as path from "path";
import { Id64, Id64Array, Id64String } from "@bentley/bentleyjs-core";
import {
  Angle, AuxChannel, AuxChannelData, AuxChannelDataType, IModelJson, Point3d, Polyface, PolyfaceAuxData, PolyfaceBuilder, StrokeOptions,
} from "@bentley/geometry-core";
import {
  CategorySelector, DefinitionModel, DisplayStyle3d, IModelDb, ModelSelector, OrthographicViewDefinition, PhysicalModel, SnapshotDb, SpatialCategory,
} from "@bentley/imodeljs-backend";
import {
  AnalysisStyleProps, Code, ColorDef, GeometryStreamBuilder, GeometryStreamProps, PhysicalElementProps, RenderMode, ThematicGradientColorScheme,
  ThematicGradientMode, ThematicGradientSettingsProps, ViewFlags,
} from "@bentley/imodeljs-common";

export class AnalysisImporter {
  public iModelDb: SnapshotDb;
  public definitionModelId: Id64String = Id64.invalid;

  public constructor(iModelFileName: string) {
    this.iModelDb = SnapshotDb.createEmpty(iModelFileName, { rootSubject: { name: "Analysis Example" } });
  }
  /** Create a geometry stream from a Polyface. */
  private generateGeometryStreamFromPolyface(polyface: Polyface): GeometryStreamProps {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(polyface);
    return builder.geometryStream;
  }

  /**  get [[AnalysisStyles] for a polyface.  This is just an example - it pairs displacement and scalar channels that have matching input names */
  private getPolyfaceAnalysisStyleProps(polyface: Polyface, displacementScaleValue: number): AnalysisStyleProps[] {
    const analysisStyleProps: AnalysisStyleProps[] = [];
    if (undefined === polyface.data.auxData)
      return analysisStyleProps;

    /**  Create a mapping from input name to channel - this is used to pair the displacement and scalar channels. */
    const displacementChannels: Map<string, AuxChannel> = new Map<string, AuxChannel>();

    for (const channel of polyface.data.auxData.channels)
      if (channel.dataType === AuxChannelDataType.Vector)
        displacementChannels.set(channel.inputName!, channel);

    for (const channel of polyface.data.auxData.channels) {
      if (undefined === channel.name)
        continue;

      if (channel.isScalar) {
        const thematicSettings: ThematicGradientSettingsProps = {};
        const displacementChannel = displacementChannels.get(channel.inputName!);
        /**  If this channel ends with "Height" assign it a "Sea to Mountain" Gradient rather than the default (green-red) gradient. */
        if (channel.name.endsWith("Height")) {
          thematicSettings.colorScheme = ThematicGradientColorScheme.SeaMountain;
          thematicSettings.mode = ThematicGradientMode.SteppedWithDelimiter;
        }

        const props: AnalysisStyleProps = {
          scalar: {
            channelName: channel.name,
            range: channel.scalarRange!,
            thematicSettings,
          },
        };

        if (undefined !== displacementChannel?.name)
          props.displacement = { channelName: displacementChannel.name, scale: displacementScaleValue };

        analysisStyleProps.push(props);
      }
    }
    return analysisStyleProps;
  }
  /** Create an analysis model for a [[Polyface]] with [[PolyfaceAuxData]] and [[DisplayStyles]] for viewing the [[AuxChannels]] */
  private createAnalysisModel(polyface: any, categoryId: Id64String, modelName: string, displacementScale = 1.0): Id64String {
    const modelId = PhysicalModel.insert(this.iModelDb, IModelDb.rootSubjectId, modelName);

    /** generate a geometry stream containing the polyface */
    const geometry = this.generateGeometryStreamFromPolyface(polyface);

    /** generate DisplayStyles to view the PolyfaceAuxData.  The display styles contain channel selection and gradient specification for the [[PolyfaceAuxData]]
     */
    const analysisStyleProps = this.getPolyfaceAnalysisStyleProps(polyface, displacementScale);
    const vf = new ViewFlags();
    const bgColor = ColorDef.white;             // White background...
    vf.renderMode = RenderMode.SolidFill;        // SolidFill rendering ... no lighting etc.

    const props: PhysicalElementProps = {
      classFullName: "Generic:PhysicalObject",
      model: modelId,
      code: Code.createEmpty(),
      category: categoryId,
      geom: geometry,
    };
    this.iModelDb.elements.insertElement(props);

    const displayStyleIds: Id64Array = [];
    const names = [];
    for (const analysisStyleProp of analysisStyleProps) {
      let name = analysisStyleProp.scalar!.channelName;
      if (undefined !== analysisStyleProp.displacement) {
        const exaggeration = (analysisStyleProp.displacement.scale === 1.0) ? "" : (` X ${analysisStyleProp.displacement.scale}`);
        name = `${modelName}: ${name} and ${analysisStyleProp.displacement.channelName}${exaggeration}`;
      }
      names.push(name);
      displayStyleIds.push(DisplayStyle3d.insert(this.iModelDb, this.definitionModelId, name, { viewFlags: vf, backgroundColor: bgColor, analysisStyle: analysisStyleProp }));
    }
    const modelSelectorId = ModelSelector.insert(this.iModelDb, this.definitionModelId, modelName, [modelId]);
    const categorySelectorId = CategorySelector.insert(this.iModelDb, this.definitionModelId, modelName, [categoryId]);

    DisplayStyle3d.insert(this.iModelDb, this.definitionModelId, `${modelName}: No AuxData`, { viewFlags: vf, backgroundColor: bgColor });
    return OrthographicViewDefinition.insert(this.iModelDb, this.definitionModelId, modelName, modelSelectorId, categorySelectorId, displayStyleIds[0], polyface.range());
  }
  /** Import a polyface with auxillary data */
  private importPolyfaceFromJson(jsonFileName: string) {
    const assetsDir = path.join(__dirname, "assets");
    const jsonString = readFileSync(path.join(assetsDir, jsonFileName), "utf8");
    const json = JSON.parse(jsonString);
    return IModelJson.Reader.parse(json);
  }

  /** Demonstrate the addition of analytical data to a polyface.
   * This is a purely fictional example intended to demonstrate concepts of [[PolyfaceAuxData]] concepts only.
   * Create a polyface representing a flat mesh with superimposed waves and associated [[PolyfaceAuxData]]  to display displacement, height and slope data.
   * A vector [[AuxChannel]] is created to represent displacement and two scalar [[AuxChannel]] are created to represent height and slope.
   * Note that data between inputs are interpolated so motion will still remain relatively smooth even with only three inputs in the radial waves.
   */
  private createFlatMeshWithWaves() {
    const options = StrokeOptions.createForFacets();
    options.shouldTriangulate = true;
    const builder = PolyfaceBuilder.create(options);
    const nDimensions = 100;
    const spacing = 1.0;

    /* Create a simple flat mesh with 10,000 points (100x100) */
    for (let iRow = 0; iRow < nDimensions - 1; iRow++) {
      for (let iColumn = 0; iColumn < nDimensions - 1; iColumn++) {
        const quad = [
          Point3d.create(iRow * spacing, iColumn * spacing, 0.0),
          Point3d.create((iRow + 1) * spacing, iColumn * spacing, 0.0),
          Point3d.create((iRow + 1) * spacing, (iColumn + 1) * spacing, 0.0),
          Point3d.create(iRow * spacing, (iColumn + 1) * spacing),
        ];
        builder.addQuadFacet(quad);
      }
    }

    const polyface = builder.claimPolyface();
    const zeroScalarData = [], zeroDisplacementData = [], radialHeightData = [], radialSlopeData = [], radialDisplacementData = [];
    const radius = nDimensions * spacing / 2.0;
    const center = new Point3d(radius, radius, 0.0);
    const maxHeight = radius / 4.0;
    const auxChannels = [];

    /** Create a radial wave - start and return to zero  */
    for (let i = 0; i < polyface.data.point.length; i++) {
      const angle = Angle.pi2Radians * polyface.data.point.distanceIndexToPoint(i, center)! / radius;
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

    // Static Channels.
    auxChannels.push(new AuxChannel([new AuxChannelData(0.0, radialDisplacementData)], AuxChannelDataType.Vector, "Static Radial Displacement", "Radial: Static"));
    auxChannels.push(new AuxChannel([new AuxChannelData(1.0, radialHeightData)], AuxChannelDataType.Distance, "Static Radial Height", "Radial: Static"));
    auxChannels.push(new AuxChannel([new AuxChannelData(1.0, radialSlopeData)], AuxChannelDataType.Scalar, "Static Radial Slope", "Radial: Static"));

    // Animated Channels.
    const radialDisplacementDataVector = [new AuxChannelData(0.0, zeroDisplacementData), new AuxChannelData(1.0, radialDisplacementData), new AuxChannelData(2.0, zeroDisplacementData)];
    const radialHeightDataVector = [new AuxChannelData(0.0, zeroScalarData), new AuxChannelData(1.0, radialHeightData), new AuxChannelData(2.0, zeroScalarData)];
    const radialSlopeDataVector = [new AuxChannelData(0.0, zeroScalarData), new AuxChannelData(1.0, radialSlopeData), new AuxChannelData(2.0, zeroScalarData)];

    auxChannels.push(new AuxChannel(radialDisplacementDataVector, AuxChannelDataType.Vector, "Animated Radial Displacement", "Radial: Time"));
    auxChannels.push(new AuxChannel(radialHeightDataVector, AuxChannelDataType.Distance, "Animated Radial Height", "Radial: Time"));
    auxChannels.push(new AuxChannel(radialSlopeDataVector, AuxChannelDataType.Scalar, "Animated Radial Slope", "Radial: Time"));

    /** Create linear waves -- 10 separate frames.  */
    const waveHeight = radius / 20.0;
    const waveLength = radius / 2.0;
    const frameCount = 10;
    const linearDisplacementDataVector = [], linearHeightDataVector = [], linearSlopeDataVector = [];

    for (let i = 0; i < frameCount; i++) {
      const fraction = i / (frameCount - 1);
      const waveCenter = waveLength * fraction;
      const linearHeightData = [], linearSlopeData = [], linearDisplacementData = [];

      for (let j = 0; j < polyface.data.point.length; j++) {
        const point = polyface.data.point.getPoint3dAtUncheckedPointIndex(j);
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
  /** Demonstrate the creation of models with analytical data. */
  public import() {
    this.definitionModelId = DefinitionModel.insert(this.iModelDb, IModelDb.rootSubjectId, "Analysis Definitions");

    /** Create category for analytical polyfaces */
    const categoryId = SpatialCategory.insert(this.iModelDb, this.definitionModelId, "GeoJSON Feature", { color: ColorDef.white.tbgr });

    /** import a polyface representing a cantilever beam with stress and displacement data. */
    const importedPolyface = this.importPolyfaceFromJson("Cantilever.json");
    /** create a model containing the imported data (with display styles, views etc.) */
    const cantileverViewId = this.createAnalysisModel(importedPolyface, categoryId, "Cantilever", 100.0);
    this.iModelDb.views.setDefaultViewId(cantileverViewId);

    /** demonstrate creation of a polyface with analytical data by creating a flat mesh and then superimposing "wave" data */
    const flatWaveMesh = this.createFlatMeshWithWaves();
    /** create a model containing the wave data (with display styles, views etc.) */
    this.createAnalysisModel(flatWaveMesh, categoryId, "Waves");

    this.iModelDb.saveChanges();
  }
}
