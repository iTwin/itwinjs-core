/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { GuidString, Id64String } from "@bentley/bentleyjs-core";
import { Point3d, Range3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { Code, CodeScopeSpec, ColorDef, IModel, IModelVersion, PhysicalElementProps } from "@bentley/imodeljs-common";
import { TestUserCredentials, TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import {
  AuthorizedBackendRequestContext, BriefcaseDb, CategorySelector, ConcurrencyControl, DisplayStyle3d, GeometricElement, IModelDb, IModelHost,
  ModelSelector, OrthographicViewDefinition, PhysicalModel, SnapshotDb, SpatialCategory,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { HubUtility } from "./HubUtility";
import { IModelWriter } from "./IModelWriter";

const pause = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class TestPushUtility {
  public iModelName?: string;
  private _iModelDb?: IModelDb;
  private _physicalModelId?: Id64String;
  private _categoryId?: Id64String;
  private _codeSpecId?: Id64String;

  private _requestContext?: AuthorizedBackendRequestContext;
  private _projectId?: string;
  private _iModelId?: GuidString;

  private _currentLevel: number = 0;

  /** Initializes the utility */
  public async initialize(projectName: string, iModelName: string, user: TestUserCredentials = TestUsers.superManager) {
    this._requestContext = await TestUtility.getAuthorizedClientRequestContext(user);
    this.iModelName = iModelName;
    this._projectId = await HubUtility.queryProjectIdByName(this._requestContext, projectName);
  }

  /** Pushes a new Test IModel to the Hub */
  public async pushTestIModel(): Promise<GuidString> {
    const pathname = this.createStandalone();
    this._iModelId = await HubUtility.pushIModel(this._requestContext!, this._projectId!, pathname);
    return this._iModelId;
  }

  /** Pushes new change sets to the Hub periodically and sets up named versions */
  public async pushTestChangeSetsAndVersions(count: number) {
    this._iModelDb = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext: this._requestContext!, contextId: this._projectId!, iModelId: this._iModelId!.toString() });
    if (this._iModelDb.isBriefcaseDb()) {
      this._iModelDb.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy()); // don't want to bother with locks.
    }
    const lastLevel = this._currentLevel + count;
    while (this._currentLevel < lastLevel) {
      await this.createTestChangeSet();
      await this.pushTestChangeSet();
      await this.createNamedVersion();
      this._currentLevel++;
      await pause(1000); // Pause between pushing change sets
    }
  }

  private createStandalone(): string {
    const pathname: string = path.join(KnownTestLocations.outputDir, `${this.iModelName}.bim`);
    if (fs.existsSync(pathname))
      fs.unlinkSync(pathname);

    this._iModelDb = SnapshotDb.createEmpty(pathname, { rootSubject: { name: this.iModelName! } });

    const definitionModelId: Id64String = IModel.dictionaryId;
    this._physicalModelId = PhysicalModel.insert(this._iModelDb, IModel.rootSubjectId, "TestModel");
    this._codeSpecId = this._iModelDb.codeSpecs.insert("TestCodeSpec", CodeScopeSpec.Type.Model);
    this._categoryId = SpatialCategory.insert(this._iModelDb, definitionModelId, "TestCategory", { color: ColorDef.fromString("blanchedAlmond").toJSON() });

    // Insert a ViewDefinition for the PhysicalModel
    const viewName = "Physical View";
    const modelSelectorId: Id64String = ModelSelector.insert(this._iModelDb, definitionModelId, viewName, [this._physicalModelId]);
    const categorySelectorId: Id64String = CategorySelector.insert(this._iModelDb, definitionModelId, viewName, [this._categoryId]);
    const displayStyleId: Id64String = DisplayStyle3d.insert(this._iModelDb, definitionModelId, viewName);
    const viewRange = new Range3d(0, 0, 0, 50, 50, 50);
    OrthographicViewDefinition.insert(this._iModelDb, definitionModelId, viewName, modelSelectorId, categorySelectorId, displayStyleId, viewRange);

    this._iModelDb.updateProjectExtents(new Range3d(-1000, -1000, -1000, 1000, 1000, 1000));

    this.insertTestElement(this._currentLevel, 0);
    this.insertTestElement(this._currentLevel, 1);
    this._iModelDb.saveChanges("Setup new iModel");
    this._currentLevel++;

    return pathname;
  }

  private createCode(name: string): Code {
    return new Code({
      spec: this._codeSpecId!,
      scope: this._physicalModelId!.toString(),
      value: name,
    });
  }

  private insertElement(name: string, userLabel: string, location: Point3d, size: Point3d = new Point3d(5, 5, 5)) {
    const testElementProps: PhysicalElementProps = {
      classFullName: "Generic:PhysicalObject",
      model: this._physicalModelId!,
      category: this._categoryId!,
      code: this.createCode(name),
      placement: { origin: location, angles: new YawPitchRollAngles() },
      geom: IModelWriter.createBox(size),
      userLabel,
    };
    const id = this._iModelDb!.elements.insertElement(testElementProps);
    return id;
  }

  private updateElement(name: string, newUserLabel: string, newSize: Point3d = new Point3d(10, 10, 10)) {
    const code = this.createCode(name);
    const element = this._iModelDb!.elements.getElement<GeometricElement>(code);
    if (!element || !(element instanceof GeometricElement))
      throw new Error(`Element with name ${name} not found`);

    element.userLabel = newUserLabel;
    element.geom = IModelWriter.createBox(newSize);

    this._iModelDb!.elements.updateElement(element);
  }

  private deleteTestElement(name: string) {
    const code = this.createCode(name);
    const id = this._iModelDb!.elements.queryElementIdByCode(code);
    if (!id)
      throw new Error(`Element with name ${name} not found`);
    this._iModelDb!.elements.deleteElement(id);
  }

  private static getElementLocation(level: number, block: number): Point3d {
    const x = block * 10;
    const y = level * 10;
    const z = 0;
    return new Point3d(x, y, z);
  }

  private static getElementName(level: number, block: number) {
    return `Element-${level}-${block}`;
  }

  private static getElementUserLabel(level: number, block: number, suffix: string) {
    return `Element (${level}, ${block}) (${suffix})`;
  }

  private static getVersionName(level: number) {
    return `Level ${level}`;
  }

  private insertTestElement(level: number, block: number) {
    const name = TestPushUtility.getElementName(level, block);
    const userLabel = TestPushUtility.getElementUserLabel(level, block, "inserted");
    this.insertElement(name, userLabel, TestPushUtility.getElementLocation(level, block), new Point3d(5, 5, 5));
  }

  private updateTestElement(level: number, block: number) {
    const name = TestPushUtility.getElementName(level, block);
    const userLabel = TestPushUtility.getElementUserLabel(level, block, "updated");
    this.updateElement(name, userLabel, new Point3d(10, 10, 10));
  }

  private deleteTestElements(level: number, block: number) {
    const name = TestPushUtility.getElementName(level, block);
    this.deleteTestElement(name);
  }

  private async createTestChangeSet() {
    this.insertTestElement(this._currentLevel, 0);
    this.insertTestElement(this._currentLevel, 1);
    if (this._iModelDb instanceof BriefcaseDb) {
      await this._iModelDb.concurrencyControl.request(this._requestContext!);
      this._iModelDb.saveChanges(`Inserted elements into level ${this._currentLevel}`);
      this.updateTestElement(this._currentLevel - 1, 0);
      await this._iModelDb.concurrencyControl.request(this._requestContext!);
      this._iModelDb.saveChanges(`Updated element in level ${this._currentLevel - 1}`);
      this.deleteTestElements(this._currentLevel - 1, 1);
      await this._iModelDb.concurrencyControl.request(this._requestContext!);
      this._iModelDb.saveChanges(`Deleted element in level ${this._currentLevel - 1}`);
    }
  }

  private static getChangeSetDescription(level: number) {
    return `Changes to level ${level} (and ${level - 1})`;
  }

  private async pushTestChangeSet() {
    const description = TestPushUtility.getChangeSetDescription(this._currentLevel);
    if (this._iModelDb instanceof BriefcaseDb) {
      await this._iModelDb.pushChanges(this._requestContext!, description);
    }
  }

  private async createNamedVersion() {
    const changeSetId = await IModelVersion.latest().evaluateChangeSet(this._requestContext!, this._iModelId!.toString(), IModelHost.iModelClient);
    await IModelHost.iModelClient.versions.create(this._requestContext!, this._iModelId!, changeSetId, TestPushUtility.getVersionName(this._currentLevel));
  }

}
