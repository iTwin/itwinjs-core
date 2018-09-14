/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module PropertyEditors */

import { PropertyValue } from "../properties/Value";
import { PropertyRecord } from "../properties/Record";
import { PropertyDescription } from "../properties/Description";

import * as React from "react";
import { AsyncValueProcessingResult } from "../converters/TypeConverter";
import { TextEditor } from "./TextEditor";

/** Each control that supports property editing must implement PropertyContainer.
 */
export interface PropertyContainer {
  commitPropertyValue(editor: PropertyEditor, record: PropertyRecord, description: PropertyDescription, newPropertyValue: PropertyValue): void;
  cancelEditor(record: PropertyRecord, description: PropertyDescription): void;
}

/** Each property editor implements DataController.
 */
export interface DataController {
  validateValue(newValue: PropertyValue, record: PropertyRecord): Promise<AsyncValueProcessingResult>;
  commitValue(newValue: PropertyValue, record: PropertyRecord): Promise<AsyncValueProcessingResult>;
}

/** PropertyEditor is the base class for all property editors.
 */
export abstract class PropertyEditor implements DataController {
  public customDataController: DataController | undefined = undefined;

  public applyEditorParams(_property: PropertyDescription, _record: PropertyRecord): void { }

  public abstract get reactElement(): React.ReactNode;

  public commitValue(newValue: PropertyValue, record: PropertyRecord): Promise<AsyncValueProcessingResult> {
    if (this.customDataController)
      return this.customDataController.commitValue(newValue, record);

    return Promise.resolve({ encounteredError: false });
  }

  public validateValue(newValue: PropertyValue, record: PropertyRecord): Promise<AsyncValueProcessingResult> {
    if (this.customDataController)
      return this.customDataController.validateValue(newValue, record);

    return Promise.resolve({ encounteredError: false });
  }

}

export abstract class DataControllerBase implements DataController {
  public commitValue(_newValue: PropertyValue, _record: PropertyRecord): Promise<AsyncValueProcessingResult> {
    return Promise.resolve({ encounteredError: false });
  }

  public validateValue(_newValue: PropertyValue, _record: PropertyRecord): Promise<AsyncValueProcessingResult> {
    return Promise.resolve({ encounteredError: false });
  }
}

/** Manages Property Editors. Property Editors are registered with and created by the manager.
 */
export class PropertyEditorManager {
  private static _editors: { [index: string]: (any) } = {};
  private static _dataControllers: { [index: string]: (any) } = {};

  public static registerEditor(editType: string, editor: typeof PropertyEditor, editorName?: string): void {
    let fullEditorName = editType;
    if (editorName)
      fullEditorName += ":" + editorName;

    if (PropertyEditorManager._editors.hasOwnProperty(fullEditorName)) {
      throw Error("PropertyEditorManager.RegisterEditor error: type '" + fullEditorName + "' already registered to '" + (typeof PropertyEditorManager._editors[fullEditorName]).toString() + "'");
    }
    PropertyEditorManager._editors[fullEditorName] = editor;
  }

  public static registerDataController(controllerName: string, controller: typeof DataControllerBase): void {
    if (PropertyEditorManager._dataControllers.hasOwnProperty(controllerName)) {
      throw Error("PropertyEditorManager.RegisterDataController error: type '" + controllerName + "' already registered to '" + (typeof PropertyEditorManager._dataControllers[controllerName]).toString() + "'");
    }
    PropertyEditorManager._dataControllers[controllerName] = controller;
  }

  public static createEditor(editType: string, editorName?: string, dataContollerName?: string): PropertyEditor | null {
    let fullEditorName = editType;
    if (editorName)
      fullEditorName += ":" + editorName;

    let editor: PropertyEditor;
    if (PropertyEditorManager._editors.hasOwnProperty(fullEditorName))
      editor = new PropertyEditorManager._editors[fullEditorName]();
    else if (PropertyEditorManager._editors.hasOwnProperty(editType))
      editor = new PropertyEditorManager._editors[editType]();
    else
      editor = new BasicPropertyEditor();

    if (dataContollerName) {
      if (PropertyEditorManager._dataControllers.hasOwnProperty(dataContollerName))
        editor.customDataController = new PropertyEditorManager._dataControllers[dataContollerName]();
    }

    return editor;
  }

  public static hasCustomEditor(editType: string, editorName: string): boolean {
    const fullEditorName = editType + ":" + editorName;
    return PropertyEditorManager._editors.hasOwnProperty(fullEditorName);
  }
}

export class BasicPropertyEditor extends PropertyEditor {

  public get reactElement(): React.ReactNode {
    return <TextEditor />;
  }
}

PropertyEditorManager.registerEditor("text", BasicPropertyEditor);
PropertyEditorManager.registerEditor("string", BasicPropertyEditor);
