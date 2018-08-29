import { Id64 } from "@bentley/bentleyjs-core";
import { Point3d, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelVersion, CodeScopeSpec, Code, ColorDef, IModel, GeometricElement3dProps, AxisAlignedBox3d } from "@bentley/imodeljs-common";
import { IModelDb, OpenParams, BriefcaseManager } from "../../backend";
import * as path from "path";
import * as fs from "fs";
import { IModelWriter } from "./IModelWriter";
import { HubUtility, UserCredentials } from "./HubUtility";
import { TestUsers } from "../IModelTestUtils";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class TestPushUtility {
  public iModelName?: string;
  private _iModelDb?: IModelDb;
  private _physicalModelId?: Id64;
  private _categoryId?: Id64;
  private _codeSpecId?: Id64;

  private _accessToken?: AccessToken;
  private _projectId?: string;
  private _iModelId?: string;

  private _currentLevel: number = 0;

  /** Initializes the utility */
  public async initialize(projectName: string, iModelName: string, user: UserCredentials = TestUsers.superManager) {
    this._accessToken = await HubUtility.login(user);
    this.iModelName = iModelName;
    this._projectId = await HubUtility.queryProjectIdByName(this._accessToken!, projectName);
  }

  /** Pushes a new Test IModel to the Hub */
  public async pushTestIModel(): Promise<string> {
    const pathname = this.createStandalone();
    this._iModelId = await HubUtility.pushIModel(this._accessToken!, this._projectId!, pathname);
    return this._iModelId;
  }

  /** Pushes new change sets to the Hub periodically and sets up named versions */
  public async pushTestChangeSetsAndVersions(count: number) {
    this._iModelDb = await IModelDb.open(this._accessToken!, this._projectId!, this._iModelId!, OpenParams.pullAndPush(), IModelVersion.latest());

    const lastLevel = this._currentLevel + count;
    while (this._currentLevel < lastLevel) {
      this.createTestChangeSet();
      await this.pushTestChangeSet();
      await this.createNamedVersion();
      this._currentLevel++;
      await pause(1000); // Pause between pushing change sets
    }
  }

  private createStandalone(): string {
    const pathname: string = path.join(__dirname, this.iModelName + ".bim");
    if (fs.existsSync(pathname))
      fs.unlinkSync(pathname);

    this._iModelDb = IModelDb.createStandalone(pathname, { rootSubject: { name: this.iModelName! } });

    const definitionModelId: Id64 = IModel.dictionaryId;
    this._physicalModelId = IModelWriter.insertPhysicalModel(this._iModelDb, "TestModel");
    this._codeSpecId = IModelWriter.insertCodeSpec(this._iModelDb, "TestCodeSpec", CodeScopeSpec.Type.Model);
    this._categoryId = IModelWriter.insertSpatialCategory(this._iModelDb, definitionModelId, "TestCategory", new ColorDef("blanchedAlmond"));

    // Insert a ViewDefinition for the PhysicalModel
    const modelSelectorId: Id64 = IModelWriter.insertModelSelector(this._iModelDb, definitionModelId, [this._physicalModelId.toString()]);
    const categorySelectorId: Id64 = IModelWriter.insertCategorySelector(this._iModelDb, definitionModelId, [this._categoryId.toString()]);
    const displayStyleId: Id64 = IModelWriter.insertDisplayStyle3d(this._iModelDb, definitionModelId);
    const physicalViewOrigin = new Point3d(0, 0, 0);
    const physicalViewExtents = new Point3d(50, 50, 50);
    IModelWriter.insertOrthographicViewDefinition(this._iModelDb, definitionModelId, "Physical View", modelSelectorId, categorySelectorId, displayStyleId, physicalViewOrigin, physicalViewExtents);

    this._iModelDb.updateProjectExtents(new AxisAlignedBox3d(new Point3d(-1000, -1000, -1000), new Point3d(1000, 1000, 1000)));

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
    const testElementProps: GeometricElement3dProps = {
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
    const element = this._iModelDb!.elements.getElement(code);
    if (!element)
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

  private createTestChangeSet() {
    this.insertTestElement(this._currentLevel, 0);
    this.insertTestElement(this._currentLevel, 1);
    this._iModelDb!.saveChanges(`Inserted elements into level ${this._currentLevel}`);
    this.updateTestElement(this._currentLevel - 1, 0);
    this._iModelDb!.saveChanges(`Updated element in level ${this._currentLevel - 1}`);
    this.deleteTestElements(this._currentLevel - 1, 1);
    this._iModelDb!.saveChanges(`Deleted element in level ${this._currentLevel - 1}`);
  }

  private static getChangeSetDescription(level: number) {
    return `Changes to level ${level} (and ${level - 1})`;
  }

  private async pushTestChangeSet() {
    const description = TestPushUtility.getChangeSetDescription(this._currentLevel);
    await this._iModelDb!.pushChanges(this._accessToken!, () => description);
  }

  private async createNamedVersion() {
    const changeSetId: string = await IModelVersion.latest().evaluateChangeSet(this._accessToken!, this._iModelId!, BriefcaseManager.imodelClient);
    await BriefcaseManager.imodelClient.Versions().create(this._accessToken!, this._iModelId!, changeSetId, TestPushUtility.getVersionName(this._currentLevel));
  }

}
