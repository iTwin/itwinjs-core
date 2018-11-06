import { IModelDb, DictionaryModel, SpatialCategory, InformationPartitionElement, DisplayStyle, DisplayStyle3d, ViewDefinition, OrthographicViewDefinition, PhysicalPartition, PhysicalModel, ModelSelector, CategorySelector } from "@bentley/imodeljs-backend";
import { IModelJsFs } from "@bentley/imodeljs-backend/lib/IModelJsFs";
import { ElementProps, DefinitionElementProps, ModelSelectorProps, SpatialViewDefinitionProps, CategorySelectorProps, BisCodeSpec, ViewFlags, ColorDef, Gradient } from "@bentley/imodeljs-common";
import { Id64, Id64String, OpenMode } from "@bentley/bentleyjs-core";
import { XYZProps, YawPitchRollProps, Matrix3d, Transform, StandardViewIndex, YawPitchRollAngles, Range1d, Range3d } from "@bentley/geometry-core";
import * as path from "path";

/** Properties for display of analysis data */
export interface AnalysisStyleProps {
    displacementChannelName?: string;
    displacementScale?: number;
    scalarChannelName?: string;
    scalarRange?: Range1d;
    scalarThematicSettings?: Gradient.ThematicSettingsProps;
    inputName?: string;
    scalarInputRange?: Range1d;
}
interface UtilitiesOpenOptions {
    copyFilename?: string;
    enableTransactions?: boolean;
    openMode?: OpenMode;
    deleteFirst?: boolean;
}
export class KnownTestLocations {

    /** The directory where test assets are stored. Keep in mind that the test is playing the role of the app. */
    public static get assetsDir(): string {
        // Assume that we are running in nodejs
        return path.join(__dirname, "assets");
    }

    /** The directory where tests can write. */
    public static get outputDir(): string {
        // Assume that we are running in nodejs
        return path.join(__dirname, "output");
    }
}
export class Utilities {
    private static async createAndInsertPhysicalPartition(iModelDb: IModelDb, modelName: string): Promise<Id64String> {
        const modelCode = InformationPartitionElement.createCode(iModelDb, IModelDb.rootSubjectId, modelName);
        if (iModelDb.elements.queryElementIdByCode(modelCode) !== undefined)
            return Promise.reject("Model already exists");

        const modeledElementProps: ElementProps = {
            classFullName: PhysicalPartition.classFullName,
            iModel: iModelDb,
            parent: { id: IModelDb.rootSubjectId, relClassName: "BisCore:SubjectOwnsPartitionElements" },
            model: IModelDb.repositoryModelId,
            code: modelCode,
        };
        const modeledElement = iModelDb.elements.createElement(modeledElementProps);
        return iModelDb.elements.insertElement(modeledElement);
    }

    private static async createAndInsertPhysicalModel(iModelDb: IModelDb, modeledElementId: Id64String, privateModel: boolean = false): Promise<Id64String> {
        const newModel = await iModelDb.models.createModel({ modeledElement: { id: modeledElementId }, classFullName: PhysicalModel.classFullName, isPrivate: privateModel });
        return iModelDb.models.insertModel(newModel);
    }
    public static async createModel(iModelDb: IModelDb, modelName: string): Promise<Id64String> {
        const modeledElementId = await Utilities.createAndInsertPhysicalPartition(iModelDb, modelName);
        return await this.createAndInsertPhysicalModel(iModelDb, modeledElementId);
    }
    // Create a SpatialCategory, insert it, and set its default appearance
    public static async createAndInsertSpatialCategory(iModelDb: IModelDb, categoryName: string): Promise<Id64String> {
        const dictionary: DictionaryModel = iModelDb.models.getModel(IModelDb.dictionaryId) as DictionaryModel;
        const cat: SpatialCategory = SpatialCategory.create(dictionary, categoryName);
        cat.id = iModelDb.elements.insertElement(cat);
        return cat.id;
    }
    public static createAndInsertDisplayStyle3d(iModelDb: IModelDb, name: string, viewFlagsIn: ViewFlags, backgroundColor?: ColorDef, analysisStyle?: AnalysisStyleProps): Id64String {
        const stylesIn: { [k: string]: any } = { viewflags: viewFlagsIn };

        if (undefined !== analysisStyle)
            stylesIn.analysisStyle = analysisStyle;

        if (undefined !== backgroundColor)
            stylesIn.backgroundColor = backgroundColor;

        const displayStyleProps: DefinitionElementProps = {
            classFullName: DisplayStyle3d.classFullName,
            model: IModelDb.dictionaryId,
            code: DisplayStyle.createCode(iModelDb, IModelDb.dictionaryId, name),
            jsonProperties: { styles: stylesIn },
            isPrivate: false,
        };
        return iModelDb.elements.insertElement(displayStyleProps);
    }
    private static insertModelSelector(iModelDb: IModelDb, modelId: Id64String, models: string[]): Id64String {
        const modelSelectorProps: ModelSelectorProps = {
            classFullName: ModelSelector.classFullName,
            model: modelId,
            code: { spec: BisCodeSpec.modelSelector, scope: modelId },
            models,
        };
        return iModelDb.elements.insertElement(modelSelectorProps);
    }
    private static insertCategorySelector(iModelDb: IModelDb, modelId: Id64String, categories: string[]): Id64String {
        const categorySelectorProps: CategorySelectorProps = {
            classFullName: CategorySelector.classFullName,
            model: modelId,
            code: { spec: BisCodeSpec.categorySelector, scope: modelId },
            categories,
        };
        return iModelDb.elements.insertElement(categorySelectorProps);
    }
    private static insertOrthographicViewDefinition(
        iModelDb: IModelDb,
        modelId: Id64String,
        viewName: string,
        modelSelectorId: Id64String,
        categorySelectorId: Id64String,
        displayStyleId: Id64String,
        origin: XYZProps,
        extents: XYZProps,
        angles?: YawPitchRollProps,
    ): Id64String {
        const viewDefinitionProps: SpatialViewDefinitionProps = {
            classFullName: OrthographicViewDefinition.classFullName,
            model: modelId,
            code: ViewDefinition.createCode(iModelDb, modelId, viewName),
            modelSelectorId,
            categorySelectorId,
            displayStyleId,
            origin,
            extents,
            angles,
            cameraOn: false,
            camera: { eye: [0, 0, 0], lens: 0, focusDist: 0 }, // not used when cameraOn === false
        };
        return iModelDb.elements.insertElement(viewDefinitionProps);
    }
    public static createOrthographicView(iModelDb: IModelDb, viewName: string, modelId: Id64String, categoryId: Id64String, range: Range3d, displayStyleId: Id64String, standardView = StandardViewIndex.Iso): Id64String {
        const modelSelectorId = Utilities.insertModelSelector(iModelDb, IModelDb.dictionaryId, [modelId.toString()]);
        const categorySelectorId = Utilities.insertCategorySelector(iModelDb, IModelDb.dictionaryId, [categoryId.toString()]);
        const rotation = Matrix3d.createStandardWorldToView(standardView);
        const angles = YawPitchRollAngles.createFromMatrix3d(rotation);
        const rotationTransform = Transform.createOriginAndMatrix(undefined, rotation);
        const rotatedRange = rotationTransform.multiplyRange(range);
        const viewOrigin = rotation.multiplyTransposeXYZ(rotatedRange.low.x, rotatedRange.low.y, rotatedRange.low.z);
        const viewExtents = rotatedRange.diagonal();
        return Utilities.insertOrthographicViewDefinition(iModelDb, IModelDb.dictionaryId, viewName, modelSelectorId, categorySelectorId, displayStyleId, viewOrigin, viewExtents, angles);
    }
    public static setDefaultViewId(iModelDb: IModelDb, viewId: Id64String) {
        const spec = { namespace: "dgn_View", name: "DefaultView" };
        const blob32 = new Uint32Array(2);

        blob32[0] = Id64.getLowerUint32(viewId);
        blob32[1] = Id64.getUpperUint32(viewId);
        const blob8 = new Uint8Array(blob32.buffer);
        iModelDb.saveFileProperty(spec, undefined, blob8);
    }
}
