/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelDb } from "@bentley/imodeljs-backend";
import { IModelTestUtils } from "./Utils";
import { AnalysisSchema } from "../AnalysisSchema";
import { AnalysisService } from "../AnalysisService";
import { Point3d, Polyface, IModelJson } from "@bentley/geometry-core";
import { Id64, OpenMode, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { readFileSync } from "fs";
import { KnownTestLocations } from "./KnownTestLocations";
import * as path from "path";

const actx = new ActivityLoggingContext("");

describe("Import Analysis Json", () => {
    it("should import analysis from test.json", async () => {
        AnalysisService.initialize(actx);

        const iModel: IModelDb = IModelTestUtils.openIModel("empty.bim", { copyFilename: "should-import-analysis.bim", deleteFirst: true, openMode: OpenMode.ReadWrite });
        assert.isTrue(iModel !== undefined);

        await AnalysisSchema.importSchema(actx, iModel);
        iModel.saveChanges();

        const modelId: Id64 = IModelTestUtils.createNewModel(iModel.elements.getRootSubject(), "AnalysisTest", false);

        const jsonString = readFileSync(path.join(KnownTestLocations.assetsDir, "RadialWave.json"), "utf8");
        const json = JSON.parse(jsonString);
        const polyface = IModelJson.Reader.parse(json);
        if (polyface instanceof Polyface)
            AnalysisService.insertMesh(iModel, modelId, "Test", Point3d.createZero(), polyface);

        iModel.saveChanges();
        iModel.closeStandalone();

        AnalysisService.shutdown();
    });
});
