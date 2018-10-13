/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ChangeSetUtilityConfig } from "./ChangeSetUtilityConfig";
import { HubUtility } from "./HubUtility";
import { IModelDbHandler } from "./IModelDbHandler";
import { TestChangesetSequence } from "./TestChangesetSequence";
import { Id64, Logger, assert, ActivityLoggingContext } from "@bentley/bentleyjs-core/lib/bentleyjs-core";
import { IModelDb } from "@bentley/imodeljs-backend/lib/backend";
import { GeometricElement3dProps, Code } from "@bentley/imodeljs-common/lib/common";
import { AccessToken } from "@bentley/imodeljs-clients/lib";
import { YawPitchRollAngles, Point3d, Box, Vector3d } from "@bentley/geometry-core/lib/geometry-core";
import { GeometryStreamBuilder, GeometryStreamProps } from "@bentley/imodeljs-common/lib/common";

const actx = new ActivityLoggingContext("");

/** Sleep for ms */
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Class to Save and Push CRUD operations for Elements in the IModelDb
 *  - Periodically creates changesets over GeometricElement3d's
 *    - EachChangeset consists of:
 *      - Creates N blocks in a horizontal level
 *      - Deletes And Updates N/2 blocks if a past level exists.
 *          -Updates change the label and geometry for the blocks
 *    - If N % 2 == 0 creates a named version for the changeset
 */
export class ChangesetGenerator {
    private _currentLevel: number = 0;
    private _iModelDb?: IModelDb;
    // Only writes to and updates iModelDb. Not responsible for opening or deleting it
    public constructor(private _accessToken: AccessToken, private _hubUtility: HubUtility,
        private _physicalModelId: Id64, private _categoryId: Id64, private _codeSpecId: Id64,
        private _iModelDbHandler: IModelDbHandler = new IModelDbHandler()) {
        Logger.logTrace(ChangeSetUtilityConfig.loggingCategory, "Initialized Changeset Generator");
        Logger.logTrace(ChangeSetUtilityConfig.loggingCategory, "--------------------------------------------------------------------------------------------");
    }
    /** Pushes new change sets to the Hub periodically and sets up named versions */
    public async pushTestChangeSetsAndVersions(projectId: string, iModelId: string, testChangesetSequence: TestChangesetSequence): Promise<boolean> {
        this._iModelDb = await this._iModelDbHandler.openLatestIModelDb(this._accessToken, projectId, iModelId);
        const untilLevel = this._currentLevel + testChangesetSequence.changesetCount;
        while (this._currentLevel < untilLevel) {
            try {
                this.createTestChangeSet(testChangesetSequence);
                await this.pushTestChangeSet(testChangesetSequence);

                // Push a named version for every other change set
                if (this._currentLevel % 2 === 0)
                    await this.createNamedVersion(iModelId);

                this._currentLevel++;
                Logger.logTrace(ChangeSetUtilityConfig.loggingCategory, `Sleeping for ${testChangesetSequence.changesetPushDelay} ms...`);
                await pause(testChangesetSequence.changesetPushDelay);
            } catch (error) {
                Logger.logError(ChangeSetUtilityConfig.loggingCategory, `Error pushing changeset: ${error}`);
            }
        }
        return true;
    }
    private createTestChangeSet(testChangesetSequence: TestChangesetSequence) {
        for (let i = 0; i < testChangesetSequence.elementsCreatedPerChangeset; i++)
            this.insertTestElement(this._currentLevel, i);
        this._iModelDb!.saveChanges(`Inserted ${testChangesetSequence.elementsCreatedPerChangeset} elements into level ${this._currentLevel}`);

        if (this._currentLevel > 0) {
            for (let i = 0; i < testChangesetSequence.elementsUpdatedPerChangeset; i++)
                this.updateTestElement(this._currentLevel - 1, i);
            this._iModelDb!.saveChanges(`Updated ${testChangesetSequence.elementsUpdatedPerChangeset} elements in level ${this._currentLevel - 1}`);

            for (let i = 1; i <= testChangesetSequence.elementsDeletedPerChangeset; i++)
                this.deleteTestElement(this._currentLevel - 1, testChangesetSequence.elementsCreatedPerChangeset - i);
            this._iModelDb!.saveChanges(`Deleted ${testChangesetSequence.elementsDeletedPerChangeset} elements in level ${this._currentLevel - 1}`);
        }
    }
    private async pushTestChangeSet(testChangesetSequence: TestChangesetSequence) {
        const description = ChangesetGenerator._getChangeSetDescription(this._currentLevel, testChangesetSequence);
        Logger.logTrace(ChangeSetUtilityConfig.loggingCategory, `Pushing change set "${description}" to the Hub`);
        await this._iModelDb!.pushChanges(actx, this._accessToken, () => description);
    }

    private async createNamedVersion(iModelId: string) {
        const name = ChangesetGenerator._getVersionName(this._currentLevel);
        const description = ChangesetGenerator._getVersionDescription(this._currentLevel);
        assert(await this._hubUtility.createNamedVersion(this._accessToken, iModelId, name, description) !== undefined);
    }

    private insertTestElement(level: number, block: number) {
        const name = ChangesetGenerator._getElementName(level, block);
        const userLabel = ChangesetGenerator._getElementUserLabel(level, block, "inserted");
        this.insertElement(name, userLabel, ChangesetGenerator._getElementLocation(level, block), new Point3d(5, 5, 5));
    }

    private updateTestElement(level: number, block: number) {
        const name = ChangesetGenerator._getElementName(level, block);
        const userLabel = ChangesetGenerator._getElementUserLabel(level, block, "updated");
        this.updateElement(name, userLabel, new Point3d(10, 10, 10));
    }

    private deleteTestElement(level: number, block: number) {
        const name = ChangesetGenerator._getElementName(level, block);
        this._deleteElement(name);
    }
    private insertElement(name: string, userLabel: string, location: Point3d, size: Point3d = new Point3d(5, 5, 5)) {
        const testElementProps: GeometricElement3dProps = {
            classFullName: "Generic:PhysicalObject",
            model: this._physicalModelId!,
            category: this._categoryId!,
            code: this._createCode(name),
            placement: { origin: location, angles: new YawPitchRollAngles() },
            geom: ChangesetGenerator._createBox(size),
            userLabel,
        };
        this._iModelDb!.elements.insertElement(testElementProps);
    }

    private updateElement(name: string, newUserLabel: string, newSize: Point3d = new Point3d(10, 10, 10)) {
        const code = this._createCode(name);
        const element = this._iModelDb!.elements.getElement(code);
        if (!element)
            throw new Error(`Element with name ${name} not found`);

        element.userLabel = newUserLabel;
        element.geom = ChangesetGenerator._createBox(newSize);

        this._iModelDb!.elements.updateElement(element);
    }

    private _deleteElement(name: string) {
        const code = this._createCode(name);
        const id = this._iModelDb!.elements.queryElementIdByCode(code);
        if (!id)
            throw new Error(`Element with name ${name} not found`);
        this._iModelDb!.elements.deleteElement(id);
    }
    private static _getElementLocation(level: number, block: number): Point3d {
        const x = block * 10;
        const y = level * 10;
        const z = 0;
        return new Point3d(x, y, z);
    }
    private static _getChangeSetDescription(level: number, testChangesetSequence: TestChangesetSequence) {
        if (level === 0)
            return `Inserted ${testChangesetSequence.elementsCreatedPerChangeset} elements on level: ${level}`;
        else
            return `Inserted ${testChangesetSequence.elementsCreatedPerChangeset} elements on level: ${level}, ` +
                `updated and deleted ${testChangesetSequence.elementsUpdatedPerChangeset} elements on level: ${level - 1}`;
    }
    private static _getElementName(level: number, block: number) {
        return `Element-${level}-${block}`;
    }

    private static _getElementUserLabel(level: number, block: number, suffix: string) {
        return `Element (${level}, ${block}) (${suffix})`;
    }

    private static _getVersionName(level: number) {
        return `Level ${level}`;
    }

    private static _getVersionDescription(level: number) {
        return `Named version for Level ${level}`;
    }
    private _createCode(name: string): Code {
        return new Code({
            spec: this._codeSpecId!,
            scope: this._physicalModelId!.toString(),
            value: name,
        });
    }
    /** Create a geometry stream containing a box */
    private static _createBox(size: Point3d): GeometryStreamProps {
        const geometryStreamBuilder = new GeometryStreamBuilder();
        geometryStreamBuilder.appendGeometry(Box.createDgnBox(
            Point3d.createZero(), Vector3d.unitX(), Vector3d.unitY(), new Point3d(0, 0, size.z),
            size.x, size.y, size.x, size.y, true,
        )!);
        return geometryStreamBuilder.geometryStream;
    }
}
