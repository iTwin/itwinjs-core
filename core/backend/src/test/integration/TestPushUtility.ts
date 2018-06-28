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
  private iModelDb?: IModelDb;
  private physicalModelId?: Id64;
  private categoryId?: Id64;
  private codeSpecId?: Id64;

  private accessToken?: AccessToken;
  private projectId?: string;
  private iModelId?: string;

  private currentLevel: number = 0;

  /** Initializes the utility */
  public async initialize(projectName: string, iModelName: string, user: UserCredentials = TestUsers.superManager) {
    this.accessToken = await HubUtility.login(user);
    this.iModelName = iModelName;
    this.projectId = await HubUtility.queryProjectIdByName(this.accessToken!, projectName);
  }

  /** Pushes a new Test IModel to the Hub */
  public async pushTestIModel(): Promise<string> {
    const pathname = this.createStandalone();
    this.iModelId = await HubUtility.pushIModel(this.accessToken!, this.projectId!, pathname);
    return this.iModelId;
  }

  /** Pushes new change sets to the Hub periodically and sets up named versions */
  public async pushTestChangeSetsAndVersions(count: number) {
    this.iModelDb = await IModelDb.open(this.accessToken!, this.projectId!, this.iModelId!, OpenParams.pullAndPush(), IModelVersion.latest());

    const lastLevel = this.currentLevel + count;
    while (this.currentLevel < lastLevel) {
      this.createTestChangeSet();
      await this.pushTestChangeSet();
      await this.createNamedVersion();
      this.currentLevel++;
      await pause(1000); // Pause between pushing change sets
    }
  }

  private createStandalone(): string {
    const pathname: string = path.join(__dirname, this.iModelName + ".bim");
    if (fs.existsSync(pathname))
      fs.unlinkSync(pathname);

    this.iModelDb = IModelDb.createStandalone(pathname, { rootSubject: { name: this.iModelName! } });

    const definitionModelId: Id64 = IModel.dictionaryId;
    this.physicalModelId = IModelWriter.insertPhysicalModel(this.iModelDb, "TestModel");
    this.codeSpecId = IModelWriter.insertCodeSpec(this.iModelDb, "TestCodeSpec", CodeScopeSpec.Type.Model);
    this.categoryId = IModelWriter.insertSpatialCategory(this.iModelDb, definitionModelId, "TestCategory", new ColorDef("blanchedAlmond"));

    // Insert a ViewDefinition for the PhysicalModel
    const modelSelectorId: Id64 = IModelWriter.insertModelSelector(this.iModelDb, definitionModelId, [this.physicalModelId.toString()]);
    const categorySelectorId: Id64 = IModelWriter.insertCategorySelector(this.iModelDb, definitionModelId, [this.categoryId.toString()]);
    const displayStyleId: Id64 = IModelWriter.insertDisplayStyle3d(this.iModelDb, definitionModelId);
    const physicalViewOrigin = new Point3d(0, 0, 0);
    const physicalViewExtents = new Point3d(50, 50, 50);
    IModelWriter.insertOrthographicViewDefinition(this.iModelDb, definitionModelId, "Physical View", modelSelectorId, categorySelectorId, displayStyleId, physicalViewOrigin, physicalViewExtents);

    this.iModelDb.updateProjectExtents(new AxisAlignedBox3d(new Point3d(-1000, -1000, -1000), new Point3d(1000, 1000, 1000)));

    this.insertTestElement(this.currentLevel, 0);
    this.insertTestElement(this.currentLevel, 1);
    this.iModelDb.saveChanges("Setup new iModel");
    this.currentLevel++;

    return pathname;
  }

  private createCode(name: string): Code {
    return new Code({
      spec: this.codeSpecId!,
      scope: this.physicalModelId!.toString(),
      value: name,
    });
  }

  private insertElement(name: string, userLabel: string, location: Point3d, size: Point3d = new Point3d(5, 5, 5)) {
    const testElementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      model: this.physicalModelId!,
      category: this.categoryId!,
      code: this.createCode(name),
      placement: { origin: location, angles: new YawPitchRollAngles() },
      geom: IModelWriter.createBox(size),
      userLabel,
    };
    const id = this.iModelDb!.elements.insertElement(testElementProps);
    return id;
  }

  private updateElement(name: string, newUserLabel: string, newSize: Point3d = new Point3d(10, 10, 10)) {
    const code = this.createCode(name);
    const element = this.iModelDb!.elements.getElement(code);
    if (!element)
      throw new Error(`Element with name ${name} not found`);

    element.userLabel = newUserLabel;
    element.geom = IModelWriter.createBox(newSize);

    this.iModelDb!.elements.updateElement(element);
  }

  private deleteTestElement(name: string) {
    const code = this.createCode(name);
    const id = this.iModelDb!.elements.queryElementIdByCode(code);
    if (!id)
      throw new Error(`Element with name ${name} not found`);
    this.iModelDb!.elements.deleteElement(id);
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
    this.insertTestElement(this.currentLevel, 0);
    this.insertTestElement(this.currentLevel, 1);
    this.iModelDb!.saveChanges(`Inserted elements into level ${this.currentLevel}`);
    this.updateTestElement(this.currentLevel - 1, 0);
    this.iModelDb!.saveChanges(`Updated element in level ${this.currentLevel - 1}`);
    this.deleteTestElements(this.currentLevel - 1, 1);
    this.iModelDb!.saveChanges(`Deleted element in level ${this.currentLevel - 1}`);
  }

  private static getChangeSetDescription(level: number) {
    return `Changes to level ${level} (and ${level - 1})`;
  }

  private async pushTestChangeSet() {
    const description = TestPushUtility.getChangeSetDescription(this.currentLevel);
    await this.iModelDb!.pushChanges(this.accessToken!, () => description);
  }

  private async createNamedVersion() {
    const changeSetId: string = await IModelVersion.latest().evaluateChangeSet(this.accessToken!, this.iModelId!, BriefcaseManager.imodelClient);
    await BriefcaseManager.imodelClient.Versions().create(this.accessToken!, this.iModelId!, changeSetId, TestPushUtility.getVersionName(this.currentLevel));
  }

}
