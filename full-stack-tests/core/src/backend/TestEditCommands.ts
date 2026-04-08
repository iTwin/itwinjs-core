/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BriefcaseDb, IModelDb, PhysicalModel, PhysicalPartition, SpatialCategory, SubCategory, SubjectOwnsPartitionElements } from "@itwin/core-backend";
import { BasicManipulationCommand, EditCommand } from "@itwin/editor-backend";
import { Id64String } from "@itwin/core-bentley";
import { CodeProps, ElementProps, IModel, RelatedElement, SaveChangesArgs, SubCategoryAppearance } from "@itwin/core-common";
import { fullStackTestCommandId, FullStackTestCommandIpc } from "../common/FullStackTestIpc";
import { testCmdIds, TestCmdOjb1, TestCmdResult, TestCommandIpc } from "../common/TestEditCommandIpc";

export abstract class TestCommand extends EditCommand implements TestCommandIpc {
  public count = 4;
  public constructor(iModel: IModelDb, protected _str: string) { super(iModel); }
  public abstract testMethod1(str1: string, str2: string, obj1: TestCmdOjb1): Promise<TestCmdResult>;
  public override async requestFinish(): Promise<string> {
    return --this.count >= 0 ? "edit command is busy" : "done";
  }
}

export class TestEditCommand1 extends TestCommand {
  public static override commandId = testCmdIds.cmd1;

  public override async onStart() {
    return `${this._str}:1`;
  }
  public async testMethod1(str1: string, str2: string, obj1: TestCmdOjb1) {
    const arr = Array.from(obj1.buf);
    arr.push(-22);
    return { str: str1 + str2, num: obj1.i1 + obj1.i2, buf: Int32Array.from(arr) };
  }
}

export class TestEditCommand2 extends TestCommand {
  public static override commandId = testCmdIds.cmd2;

  public override async onStart() {
    return `${this._str}:2`;
  }

  public async testMethod1(str1: string, str2: string, obj1: TestCmdOjb1) {
    const arr = Array.from(obj1.buf);
    arr.push(-32);
    return { str: str2 + str1, num: obj1.i1 - obj1.i2, buf: Int32Array.from(arr) };
  }
}

/** EditCommand for full-stack testing that extends BasicManipulationCommand */
export class FullStackTestEditCommand extends BasicManipulationCommand implements FullStackTestCommandIpc {
  public static override commandId = fullStackTestCommandId;

  public constructor(iModel: IModelDb, _str = "") {
    super(iModel, _str);
    this.appData = { suite: "full-stack-tests" };
  }

  public override async onStart(): Promise<any> {
    return "FullStackTestEditCommand";
  }

  private verifyIModelKey(iModelKey: string): void {
    const iModelDb = IModelDb.findByKey(iModelKey);
    if (iModelDb !== this.iModel)
      throw new Error("EditCommand iModel key mismatch");
  }

  private beginSaveArgsEdit(iModelKey: string, propertyName: string): void {
    this.verifyIModelKey(iModelKey);
    this.beginEditing();
    this.txn.saveFileProperty({ name: propertyName, namespace: "FullStackTestEditCommand" }, propertyName);
  }

  private static createAndInsertPartition(iModel: IModelDb, txn: { insertElement(elProps: ElementProps, options?: any): Id64String }, newModelCode: CodeProps): Id64String {
    const modeledElementProps: ElementProps = {
      classFullName: PhysicalPartition.classFullName,
      parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
      model: IModel.repositoryModelId,
      code: newModelCode,
    };
    const modeledElement = iModel.elements.createElement(modeledElementProps);
    return txn.insertElement(modeledElement.toJSON());
  }

  public async createAndInsertPhysicalModel(key: string, newModelCode: CodeProps): Promise<Id64String> {
    this.verifyIModelKey(key);

    this.beginEditing();
    const eid = FullStackTestEditCommand.createAndInsertPartition(this.iModel, this.txn, newModelCode);
    const modeledElementRef = new RelatedElement({ id: eid });
    const newModel = this.iModel.models.createModel({ modeledElement: modeledElementRef, classFullName: PhysicalModel.classFullName, isPrivate: false });
    return this.txn.insertModel(newModel.toJSON());
  }

  public async createAndInsertSpatialCategory(key: string, scopeModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance.Props): Promise<Id64String> {
    this.verifyIModelKey(key);

    this.beginEditing();
    const category = SpatialCategory.create(this.iModel, scopeModelId, categoryName);
    const categoryId = this.txn.insertElement(category.toJSON());
    const subCategory = this.iModel.elements.getElement<SubCategory>(IModelDb.getDefaultSubCategoryId(categoryId));
    subCategory.appearance = new SubCategoryAppearance(appearance);
    this.txn.updateElement(subCategory.toJSON());
    return categoryId;
  }

  public async insertElement(iModelKey: string, props: ElementProps): Promise<Id64String> {
    this.verifyIModelKey(iModelKey);
    this.beginEditing();
    return this.txn.insertElement(props);
  }

  public async updateElement(iModelKey: string, props: ElementProps): Promise<void> {
    this.verifyIModelKey(iModelKey);
    this.beginEditing();
    this.txn.updateElement(props);
  }

  public async deleteDefinitionElements(iModelKey: string, ids: string[]): Promise<void> {
    this.verifyIModelKey(iModelKey);
    this.beginEditing();
    this.txn.deleteDefinitionElements(ids);
  }

  public async saveChangesAndReturnProps(iModelKey: string, propertyName: string, description?: string): Promise<SaveChangesArgs | undefined> {
    this.beginSaveArgsEdit(iModelKey, propertyName);
    await this.saveChanges(description);
    return (this.iModel as BriefcaseDb).txns.getLastSavedTxnProps()?.props;
  }

  public async endEditsAndReturnProps(iModelKey: string, propertyName: string, description?: string): Promise<SaveChangesArgs | undefined> {
    this.beginSaveArgsEdit(iModelKey, propertyName);
    await this.endEdits(description);
    return (this.iModel as BriefcaseDb).txns.getLastSavedTxnProps()?.props;
  }
}
