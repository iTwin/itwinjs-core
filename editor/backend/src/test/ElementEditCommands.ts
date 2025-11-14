/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelDb, PhysicalElement, Schema } from "@itwin/core-backend";
import { Code, PhysicalElementProps } from "@itwin/core-common";
import { EditCommandArgs, ImmediateCommand, InteractiveCommand, makeScopeSafe } from "../IModelEditCommand";
import { Id64String } from "@itwin/core-bentley";

// This rule was deprecated in ESLint v8.46.0.
/* eslint-disable @typescript-eslint/return-await */

/**
 * Test schema for element editing commands
 */
export class TestEditCommandSchema extends Schema {
  public static override get schemaName(): string { return "TestEditCommand"; }
  public static get schemaXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestEditCommand" alias="tec" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="1.0.25" alias="bis"/>

          <ECEntityClass typeName="TestElement">
              <BaseClass>bis:PhysicalElement</BaseClass>
              <ECProperty propertyName="IntProperty" typeName="int" />
              <ECProperty propertyName="StringProperty" typeName="string" />
              <ECProperty propertyName="DoubleProperty" typeName="double" />
          </ECEntityClass>
      </ECSchema>`;
  }
}

/**
 * Test element class
 */
export class TestElement extends PhysicalElement {
  public static override get className(): string { return "TestElement"; }
  public static get fullClassName(): string { return "TestEditCommand:TestElement"; }

  public intProperty?: number;
  public stringProperty?: string;
  public doubleProperty?: number;

  protected constructor(props: TestElementProps, iModel: IModelDb) {
    super(props, iModel);
    this.intProperty = props.intProperty;
    this.stringProperty = props.stringProperty;
    this.doubleProperty = props.doubleProperty;
  }
  public override toJSON(): PhysicalElementProps {
    const val = super.toJSON() as TestElementProps;
    val.intProperty = this.intProperty;
    val.stringProperty = this.stringProperty;
    val.doubleProperty = this.doubleProperty;
    return val;
  }
}

interface TestElementProps extends PhysicalElementProps {
  intProperty?: number;
  stringProperty?: string;
  doubleProperty?: number;
}

/**
 * Arguments for creating an element
 */
export interface CreateElementArgs extends EditCommandArgs {
  userLabel: string;
  testElementProps: TestElementProps;
}

/**
 * Arguments for updating an element
 */
export interface UpdateElementArgs extends EditCommandArgs {
  elementId: string;
  intProperty?: number;
  stringProperty?: string;
  doubleProperty?: number;
}

/**
 * Arguments for deleting an element
 */
export interface DeleteElementArgs extends EditCommandArgs {
  elementId: string;
}

/**
 * Immediate command to create a test element
 */
export class CreateElementCommand extends ImmediateCommand<CreateElementArgs, string> {
  @makeScopeSafe
  public async createElement(args: CreateElementArgs): Promise<Id64String> {
    const props: TestElementProps = {
      classFullName: "TestEditCommand:TestElement",
      model: args.testElementProps.model,
      category: args.testElementProps.category,
      code: Code.createEmpty(),
      userLabel: args.userLabel,
      intProperty: args.testElementProps.intProperty,
      stringProperty: args.testElementProps.stringProperty,
      doubleProperty: args.testElementProps.doubleProperty,
    };

    const elementId = this._iModel.elements.insertElement(props);
    return elementId;
  }

  public override async validateCommandResult(result: Id64String): Promise<boolean> {
    return this._iModel.elements.tryGetElement<TestElement>(result) !== undefined;
  }
}

/**
 * Immediate command to update a test element
 */
export class UpdateElementCommand extends ImmediateCommand<UpdateElementArgs, Id64String> {
  @makeScopeSafe
  public async updateElement(args: UpdateElementArgs): Promise<Id64String> {
    const element = this._iModel.elements.getElement<TestElement>(args.elementId);
    const elementJson: any = element.toJSON();

    if (args.intProperty !== undefined) {
      elementJson.intProperty = args.intProperty;
    }
    if (args.stringProperty !== undefined) {
      elementJson.stringProperty = args.stringProperty;
    }
    if (args.doubleProperty !== undefined) {
      elementJson.doubleProperty = args.doubleProperty;
    }

    // Simulate some async work
    await new Promise(resolve => setTimeout(resolve, 100));

    this._iModel.elements.updateElement(elementJson);

    return element.id;
  }

  public override async validateCommandResult(result: Id64String): Promise<boolean> {
    return this._iModel.elements.tryGetElement<TestElement>(result) !== undefined;
  }
}

/**
 * Immediate command to delete a test element
 */
export class DeleteElementCommand extends ImmediateCommand<DeleteElementArgs, Id64String> {
  @makeScopeSafe
  public async deleteElement(args: DeleteElementArgs): Promise<Id64String> {
    this._iModel.elements.deleteElement(args.elementId);
    return args.elementId;
  }

  public override async validateCommandResult(result: Id64String): Promise<boolean> {
    return this._iModel.elements.tryGetElement<TestElement>(result) === undefined;
  }
}

interface InteractiveElementAPIArgs extends EditCommandArgs {
  elementId?: Id64String;
}

export class InteractiveElementAPI extends InteractiveCommand<InteractiveElementAPIArgs, Id64String> {
  @makeScopeSafe
  public async createElementAndUpdateProperties(modelId: Id64String, categoryId: Id64String): Promise<Id64String> {
    const createCmd = new CreateElementCommand(this._iModel);
    const elementId = await createCmd.createElement({
      userLabel: "InteractiveCreatedElement",
      testElementProps: {
        classFullName: TestElement.fullClassName,
        code: Code.createEmpty(),
        model: modelId,
        category: categoryId,
        intProperty: 10,
        stringProperty: "FirstValue",
        doubleProperty: 20.5,
      },
    });

    const updateCmd = new UpdateElementCommand(this._iModel);
    await updateCmd.updateElement({
      elementId,
      intProperty: 42,
      stringProperty: "SecondValue",
      doubleProperty: 84.0,
    });

    return elementId;
  }

  @makeScopeSafe
  public async updateElement(elementId: Id64String, intProperty: number, stringProperty: string, doubleProperty: number): Promise<Id64String> {
    const updateCmd = new UpdateElementCommand(this._iModel);
    const updatedElementId = await updateCmd.updateElement({
      elementId,
      intProperty,
      stringProperty,
      doubleProperty,
    });

    return updatedElementId;
  }
}