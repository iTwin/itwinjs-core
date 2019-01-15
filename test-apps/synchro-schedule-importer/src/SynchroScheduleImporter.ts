/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelHost, IModelHostConfiguration, IModelDb, ECSqlStatement, IModelJsFs, ViewDefinition, DisplayStyle3d, OrthographicViewDefinition } from "@bentley/imodeljs-backend";
import { OpenMode, DbResult, Id64String } from "@bentley/bentleyjs-core";
import { Placement3d, ElementAlignedBox3d, AxisAlignedBox3d, RenderMode, ViewFlags, ColorDef } from "@bentley/imodeljs-common";
import { YawPitchRollAngles, Point3d } from "@bentley/geometry-core";
import * as Yargs from "yargs";
import { readFileSync, writeFileSync, unlinkSync } from "fs";

interface ImportInputArgs {
    input: string;
    createDuplicateIbim: boolean;
    fixRange: boolean;
    script: string;
    createSeparateScript: boolean;
    duplicateIbim: boolean;
}

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
    public batchId: number;
    constructor(ids: Id64String[], data: any, batchId: number) { this.elementIds = ids, this.data = data; this.batchId = batchId; }
    public getJSON(): any {
        const json: any = { elementIds: this.elementIds, batchId: this.batchId };
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
            this.entries.set(key, new ScriptEntry(ids, data, 1 + this.entries.size));
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
        if (entry.value && entry.value.transform) {
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++)
                    if (Math.abs(entry.value.transform[i][j] - ((i === j) ? 1 : 0)) > 1.0E-5)
                        return false;
                if (Math.abs(entry.value.transform[i][3]) > .1)       // Ignore translations less than .1MM (Synchro files are currently in millimeters)
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
        const vf = new ViewFlags();
        vf.renderMode = RenderMode.SmoothShade;
        vf.cameraLights = true;
        const bgColor = new ColorDef("rgb(127, 127, 127)");

        const displayStyleId = DisplayStyle3d.insert(iModel, view.model, "Schedule View Style", { viewFlags: vf, backgroundColor: bgColor, scheduleScript: script });
        const displayStyleProps = iModel.elements.getElementProps(displayStyleId);
        iModel.elements.updateElement(displayStyleProps);
        iModel.views.setDefaultViewId(OrthographicViewDefinition.insert(iModel, view.model, "Schedule View", view.modelSelectorId, view.categorySelectorId, displayStyleId, iModel.projectExtents));
        return true;
    });
    return true;
}

function doImport(inputArgs: Yargs.Arguments<ImportInputArgs>) {
    let originalIModel: IModelDb;

    try {
        originalIModel = IModelDb.openStandalone(inputArgs.input as string, inputArgs.createDuplicateIbim ? OpenMode.Readonly : OpenMode.ReadWrite); // could throw Error
    } catch (error) {
        process.stdout.write("Unable to open: " + inputArgs.input + "\n");
        return false;
    }

    let outputIModel = originalIModel;
    let outputFileName = inputArgs.input as string;
    if (inputArgs.createDuplicateIbim) {
        outputFileName = inputArgs.input + ".animated.ibim";
        IModelJsFs.copySync(inputArgs.input as string, outputFileName);
        outputIModel = IModelDb.openStandalone(outputFileName, OpenMode.ReadWrite);
    }
    try { unlinkSync(outputFileName + ".tiles"); } catch (error) { }
    if (inputArgs.fixRange)
        doFixRange(outputIModel);

    if (inputArgs.script) {
        if (doAddAnimationScript(outputIModel, inputArgs.script as string, inputArgs.createSeparateScript as boolean))
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
Yargs.default("fixRange", true, "Set the project extents to the range of all geometry");
Yargs.default("createSeparateScript", true, "Create a separate file with the JSON for the animation script (debugging)");
Yargs.default("createDuplicateIbim", true, "Create a duplicate IBIM with the imported script (rather than writing to original)");
Yargs.required("script", "Animation script JSON file");
Yargs.string("script");
const args = Yargs.parse() as Yargs.Arguments<ImportInputArgs>;

IModelHost.startup(new IModelHostConfiguration());
doImport(args);
