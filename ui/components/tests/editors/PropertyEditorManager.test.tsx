/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { expect } from "chai";
import { PropertyEditorManager, BasicPropertyEditor, PropertyEditor, DataControllerBase } from "../../src/editors/PropertyEditorManager";
import { TextEditor } from "../../src/editors/TextEditor";
import { PropertyValue, PropertyValueFormat, PropertyDescription, PropertyRecord, PropertyEditorParams, PropertyEditorParamTypes } from "../../src/properties";
import { AsyncValueProcessingResult } from "../../src/converters/TypeConverter";

describe("PropertyEditorManager", () => {
  it("createEditor should create a BasicPropertyEditor for unknown type", () => {
    const propertyEditor = PropertyEditorManager.createEditor("test");
    expect(propertyEditor).to.not.be.null;
    if (propertyEditor) {
      expect(propertyEditor).to.be.instanceof(BasicPropertyEditor);
      expect(React.isValidElement(propertyEditor.reactElement)).to.be.true;
    }
  });

  it("createEditor should create a BasicPropertyEditor for 'text' type", () => {
    const propertyEditor = PropertyEditorManager.createEditor("text");
    expect(propertyEditor).to.be.instanceof(BasicPropertyEditor);
  });

  it("createEditor should create a BasicPropertyEditor for 'string' type", () => {
    const propertyEditor = PropertyEditorManager.createEditor("string");
    expect(propertyEditor).to.be.instanceof(BasicPropertyEditor);
  });

  class MinePropertyEditor extends PropertyEditor {
    public get reactElement(): React.ReactNode {
      return <TextEditor />;
    }
  }

  it("createEditor should create a MinePropertyEditor for a registered 'mine' type", () => {
    PropertyEditorManager.registerEditor("mine", MinePropertyEditor);
    const propertyEditor = PropertyEditorManager.createEditor("mine");
    expect(propertyEditor).to.be.instanceof(MinePropertyEditor);
  });

  it("registerEditor should throw an exception if type already registered", () => {
    PropertyEditorManager.registerEditor("mine2", MinePropertyEditor);
    expect(() => PropertyEditorManager.registerEditor("mine2", MinePropertyEditor)).to.throw(Error);
  });

  it("createEditor should create a MinePropertyEditor for a registered 'mine' type and 'myeditor' editor", () => {
    PropertyEditorManager.registerEditor("mine3", MinePropertyEditor, "myeditor");
    expect(PropertyEditorManager.hasCustomEditor("mine3", "myeditor")).to.be.true;
    const propertyEditor = PropertyEditorManager.createEditor("mine3", "myeditor");
    expect(propertyEditor).to.be.instanceof(MinePropertyEditor);
  });

  class MineDataController extends DataControllerBase { }

  it("createEditor should create a MinePropertyEditor with a dataController of MineDataController", () => {
    PropertyEditorManager.registerEditor("mine4", MinePropertyEditor, "myeditor");
    PropertyEditorManager.registerDataController("mydata", MineDataController);
    const propertyEditor = PropertyEditorManager.createEditor("mine4", "myeditor", "mydata");
    expect(propertyEditor).to.not.be.null;
    if (propertyEditor) {
      expect(propertyEditor).to.be.instanceof(MinePropertyEditor);
      expect(propertyEditor.customDataController).to.be.instanceof(MineDataController);
    }
  });

  it("createEditor should create a MinePropertyEditor even when passed a bad editor name", () => {
    PropertyEditorManager.registerEditor("mine5", MinePropertyEditor);
    const propertyEditor = PropertyEditorManager.createEditor("mine5", "badeditor");
    expect(propertyEditor).to.not.be.null;
    if (propertyEditor) {
      expect(propertyEditor).to.be.instanceof(MinePropertyEditor);
    }
  });

  it("registerDataController should throw an exception if already registered", () => {
    PropertyEditorManager.registerDataController("mydata2", MineDataController);
    expect(() => PropertyEditorManager.registerDataController("mydata2", MineDataController)).to.throw(Error);
  });

  const createPropertyValue = (value?: string): PropertyValue => {
    const v: PropertyValue = {
      valueFormat: PropertyValueFormat.Primitive,
      displayValue: value ? value : "",
      value,
    };
    return v;
  };

  const createPropertyDescription = (): PropertyDescription => {
    const pd: PropertyDescription = {
      typename: "text",
      name: "key",
      displayLabel: "label",
    };
    return pd;
  };

  const createPropertyRecord = (value?: string): PropertyRecord => {
    const v = createPropertyValue(value);
    const pd = createPropertyDescription();
    return new PropertyRecord(v, pd);
  };

  it("calling validateValue & commitResult on PropertyEditor without dataController should encounter no error", async () => {
    PropertyEditorManager.registerEditor("mine7", MinePropertyEditor);
    const propertyEditor = PropertyEditorManager.createEditor("mine7");
    expect(propertyEditor).to.not.be.null;
    if (propertyEditor) {
      const validateResult = await propertyEditor.validateValue(createPropertyValue("newvalue"), createPropertyRecord("value"));
      expect(validateResult.encounteredError).to.be.false;
      const commitResult = await propertyEditor.commitValue(createPropertyValue("newvalue"), createPropertyRecord("value"));
      expect(commitResult.encounteredError).to.be.false;
    }
  });

  it("calling validateValue & commitResult on PropertyEditor with a dataController should encounter no error", async () => {
    PropertyEditorManager.registerEditor("mine8", MinePropertyEditor);
    PropertyEditorManager.registerDataController("mydata3", MineDataController);
    const propertyEditor = PropertyEditorManager.createEditor("mine8", undefined, "mydata3");
    expect(propertyEditor).to.not.be.null;
    if (propertyEditor) {
      const validateResult = await propertyEditor.validateValue(createPropertyValue("newvalue"), createPropertyRecord("value"));
      expect(validateResult.encounteredError).to.be.false;
      const commitResult = await propertyEditor.commitValue(createPropertyValue("newvalue"), createPropertyRecord("value"));
      expect(commitResult.encounteredError).to.be.false;
    }
  });

  class ErrorDataController extends DataControllerBase {
    public commitValue(_newValue: PropertyValue, _record: PropertyRecord): Promise<AsyncValueProcessingResult> {
      return Promise.resolve({ encounteredError: true });
    }

    public validateValue(_newValue: PropertyValue, _record: PropertyRecord): Promise<AsyncValueProcessingResult> {
      return Promise.resolve({ encounteredError: true });
    }
  }

  it("calling validateValue & commitResult on PropertyEditor with a dataController returning errors should report errors", async () => {
    PropertyEditorManager.registerEditor("mine9", MinePropertyEditor);
    PropertyEditorManager.registerDataController("mydata4", ErrorDataController);
    const propertyEditor = PropertyEditorManager.createEditor("mine9", undefined, "mydata4");
    expect(propertyEditor).to.not.be.null;
    if (propertyEditor) {
      const validateResult = await propertyEditor.validateValue(createPropertyValue("newvalue"), createPropertyRecord("value"));
      expect(validateResult.encounteredError).to.be.true;
      const commitResult = await propertyEditor.commitValue(createPropertyValue("newvalue"), createPropertyRecord("value"));
      expect(commitResult.encounteredError).to.be.true;
    }
  });

  class PropertyEditorWithEditorParams extends PropertyEditor {
    public get reactElement(): React.ReactNode {
      return <TextEditor />;
    }

    public applyEditorParams(property: PropertyDescription, record: PropertyRecord): void {
      if (property.editor && property.editor.params) {
        property.editor.params.forEach((params: PropertyEditorParams) => {
          if (params.type === PropertyEditorParamTypes.Icon) {
            if (params.definition.iconPath === "cool")
              (record as any).iconParamsWorked = true;
          }
        });
      }
    }
  }

  it("applyEditorParams", () => {
    PropertyEditorManager.registerEditor("withEditorParams", PropertyEditorWithEditorParams);
    const propertyEditor = PropertyEditorManager.createEditor("withEditorParams");
    expect(propertyEditor).to.be.instanceof(PropertyEditorWithEditorParams);
    if (propertyEditor) {
      const propertyDescription = createPropertyDescription();
      propertyDescription.editor = {
        name: "",
        params: [
          {
            type: PropertyEditorParamTypes.Icon,
            definition: { iconPath: "cool", iconColor: 0 },
          },
        ],
      };
      const propertyRecord = createPropertyRecord("value");
      propertyEditor.applyEditorParams(propertyDescription, propertyRecord);
      const iconParamsWorked = ((propertyRecord as any).iconParamsWorked as boolean);
      expect(iconParamsWorked).to.be.true;
    }
  });

});
