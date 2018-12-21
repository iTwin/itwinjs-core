/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelHost, IModelHostConfiguration, IModelDb, ECSqlStatement, IModelJsFs, ViewDefinition, GeometricElement, DisplayStyle3d, OrthographicViewDefinition } from "@bentley/imodeljs-backend";
import { OpenMode, DbResult, Id64String } from "@bentley/bentleyjs-core";
import { Placement3d, ElementAlignedBox3d, AxisAlignedBox3d, RenderMode, ViewFlags, ColorDef } from "@bentley/imodeljs-common";
import { YawPitchRollAngles, Point3d, Transform } from "@bentley/geometry-core";
import * as Yargs from "yargs";
import { readFileSync, writeFileSync } from "fs";

function doFixRange(iModel: IModelDb) {
    const totalRange = new AxisAlignedBox3d();

    iModel.withPreparedStatement("SELECT ECInstanceId,Category.Id,Origin,Yaw,Pitch,Roll,BBoxLow,BBoxHigh FROM bis.GeometricElement3d", (stmt: ECSqlStatement) => {
        while (DbResult.BE_SQLITE_ROW === stmt.step()) {
            const row = stmt.getRow();
            if (undefined !== row.bBoxLow && undefined !== row.bBoxHigh && undefined !== row.origin) {
                const box = ElementAlignedBox3d.createFromPoints(row.bBoxLow, row.bBoxHigh);
                const placement = new Placement3d(Point3d.fromJSON(row.origin), YawPitchRollAngles.createDegrees(row.yaw, row.pitch, row.roll), box);
                const range = placement.calculateRange();
                totalRange.extendRange(range);
            }
        }
    });
    if (totalRange.isNull)
        return;

    iModel.updateProjectExtents(totalRange);
}

class ScriptEntry {
    public elementIds: Id64String[] = [];
    public data: any;
    constructor(ids: Id64String[], data: any) { this.elementIds = ids, this.data = data; }
    public getJSON(): any {
        const json: any = { elementIds: this.elementIds };
        for (const [key, value] of Object.entries(this.data))
            json[key] = value;

        return json;
    }
}

class ModelScript {
    public entries: Map<string, ScriptEntry> = new Map<string, ScriptEntry>();
    constructor(public modelId: Id64String) { }

    private getChildIds(ids: Id64String[], parentId: Id64String, iModel: IModelDb) {
        const children = iModel.elements.queryChildren(parentId);
        for (const childId of children) {
            ids.push(childId);
            this.getChildIds(ids, childId, iModel);
        }
    }
    public addEntry(parentId: Id64String, data: any, iModel: IModelDb) {
        const ids = [parentId];
        this.getChildIds(ids, parentId, iModel);
        const key = JSON.stringify(data);
        let value: any;
        if (undefined === (value = this.entries.get(key))) {
            this.entries.set(key, new ScriptEntry(ids, data));
        } else {
            for (const id of ids)
                value.elementIds.push(id);
        }
    }
    public getJSON(): any {
        const json: any = { modelId: this.modelId, elementTimelines: [] };
        this.entries.forEach((entry) => json.elementTimelines.push(entry.getJSON()));
        return json;
    }
}

function transformTimelineIsIdentity(transformTimeline: any) {
    if (!transformTimeline || !Array.isArray(transformTimeline))
        return true;

    for (const entry of transformTimeline) {
        if (entry.value) {
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++)
                    if (Math.abs(entry.value[i][j] - ((i === j) ? 1 : 0)) > 1.0E-5)
                        return false;
                if (Math.abs(entry.value[i][3]) > .1)       // Ignore translations less than .1MM (Synchro files are currently in millimeters)
                    return false;
            }
        }
    }
    return true;
}
function timelineValuesAreNull(timeline: any) {
    if (!timeline || !Array.isArray(timeline))
        return true;

    for (const entry of timeline)
        if (entry.value !== null)
            return false;

    return true;
}

function animationScriptFromSynchro(synchroJson: object, iModel: IModelDb): any {
    if (!Array.isArray(synchroJson)) return undefined;
    const modelScripts: Map<Id64String, ModelScript> = new Map<Id64String, ModelScript>();

    synchroJson.forEach((entry) => {
        const element = iModel.elements.getElementProps(entry.elementID);

        const isolateId = undefined;
        if (isolateId && !entry.elementID.endsWith(isolateId))
            return;

        let modelScript = modelScripts.get(element.model);
        if (undefined === modelScript)
            modelScripts.set(element.model, modelScript = new ModelScript(element.model));

        const elementId: Id64String = entry.elementID;
        const data: any = {};
        for (const [key, value] of Object.entries(entry)) {
            switch (key) {
                case "elementID":
                    break;
                case "transformTimeline":
                    const thisElement = iModel.elements.getElement(elementId) as GeometricElement;
                    if (thisElement && Array.isArray(value)) {
                        for (const timelineEntry of value) {
                            if (timelineEntry.value) {
                                const entryTransform = Transform.fromJSON(timelineEntry.value);
                                const inverseElementMatrix = thisElement.placement.rotation.inverse();
                                const matrix = entryTransform.matrix.multiplyMatrixMatrix(inverseElementMatrix);
                                timelineEntry.value = Transform.createRefs(entryTransform.origin, matrix).toJSON();
                            }
                        }
                    }
                    if (!transformTimelineIsIdentity(value))
                        data[key] = value;
                    break;
                default:
                    if (!timelineValuesAreNull(value))
                        data[key] = value;
                    break;
            }
        }
        if (elementId !== undefined && data !== undefined)
            modelScript.addEntry(elementId, data, iModel);

    });
    const script: object[] = [];
    modelScripts.forEach((modelScript) => {
        script.push(modelScript.getJSON());
    });
    return script;
}

function doAddAnimationScript(iModel: IModelDb, animationScript: string, createSeparateScriptFile: boolean) {
    const jsonString = readFileSync(animationScript, "utf8");
    const json = JSON.parse(jsonString);
    if (json === undefined) {
        process.stdout.write("Unable to parse json from animation script: " + animationScript + "\n");
        return false;
    }
    const script = animationScriptFromSynchro(json, iModel);
    if (createSeparateScriptFile)
        writeFileSync(animationScript + ".output.json", JSON.stringify(script));

    iModel.views.iterateViews({ from: "BisCore.SpatialViewDefinition" }, (view: ViewDefinition) => {
        // Create a new display style.
        const viewFlags = new ViewFlags();
        viewFlags.renderMode = RenderMode.SmoothShade;
        viewFlags.cameraLights = true;
        const backgroundColor = new ColorDef("rgb(127, 127, 127)");

        const displayStyleId = DisplayStyle3d.insert(iModel, view.model, "Schedule View Style", viewFlags, backgroundColor);
        const displayStyleProps = iModel.elements.getElementProps(displayStyleId);
        displayStyleProps.jsonProperties.styles.scheduleScript = script;        // Add schedule to the display style propertiies.
        iModel.elements.updateElement(displayStyleProps);
        iModel.views.setDefaultViewId(OrthographicViewDefinition.insert(iModel, view.model, "Schedule View", view.modelSelectorId, view.categorySelectorId, displayStyleId, iModel.projectExtents));
        return true;
    });
    return true;
}
function doImport(inputArgs: Yargs.Arguments<{}>) {
    let originalIModel: IModelDb;

    try {
        originalIModel = IModelDb.openStandalone(inputArgs.input, inputArgs.createDuplicateIbim ? OpenMode.Readonly : OpenMode.ReadWrite); // could throw Error
    } catch (error) {
        process.stdout.write("Unable to open: " + inputArgs.input + "\n");
        return false;
    }

    let outputIModel = originalIModel;
    let outputFileName = inputArgs.input;
    if (inputArgs.createDuplicateIbim) {
        outputFileName = inputArgs.input + ".animated.ibim";
        IModelJsFs.copySync(inputArgs.input, outputFileName);
        outputIModel = IModelDb.openStandalone(outputFileName, OpenMode.ReadWrite);
    }

    if (inputArgs.fixRange)
        doFixRange(outputIModel);

    if (inputArgs.script) {
        if (doAddAnimationScript(outputIModel, inputArgs.script, inputArgs.createSeparateScript))
            process.stdout.write("Animation Script: " + inputArgs.script + " added to: " + outputFileName + "\n");
    }

    try {
        outputIModel.saveChanges();
    } catch (error) {
        process.stdout.write("Unable to save changes to: " + outputFileName + "\n");
    }

    originalIModel.closeStandalone();
    if (inputArgs.duplicateIbim)
        outputIModel.closeStandalone();

    return true;
}

Yargs.usage("Import a Syncro JSON animation script into an existing IBIM file.");
Yargs.required("input", "The input IBIM");
Yargs.default("fixRange", false, "Set the project extents to the range of all geometry");
Yargs.default("createSeparateScript", false, "Create a seperate file with the JSON for the animation script (debugging)");
Yargs.default("createDuplicateIbim", false, "Create a duplicate IBIM with the imported script (rather than writing to original)");
Yargs.required("script", "Animation script JSON file");
Yargs.string("script");
Yargs.boolean("fixRange");
const args = Yargs.parse();

IModelHost.startup(new IModelHostConfiguration());
doImport(args);
