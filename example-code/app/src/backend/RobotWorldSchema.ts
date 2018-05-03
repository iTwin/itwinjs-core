/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ ClassRegistry.registerModule
import { ClassRegistry, Schema, Schemas, IModelDb, DictionaryModel, SpatialCategory, IModelHost } from "@bentley/imodeljs-backend";
import { IModelError, IModelStatus, Appearance, ColorByName } from "@bentley/imodeljs-common";
import * as path from "path";
import * as _schemaNames from "../common/RobotWorldSchema";

// Import all modules that define classes in this schema.
import * as robots from "./RobotElement";
import * as obstacles from "./BarrierElement";
// ... other modules ...

/** An example of defining a class that represents a schema.
 * Normally, you would define a schema class like this by first
 * generating an ECSchema and then generating a Schema definition
 * like this from it. Note that you do not have to define a Schema
 * to work with elements in that schema.
 */
export class RobotWorldSchema extends Schema {
  /** An app must call this to register the RobotWorld schema prior to using it. */
  public static registerSchema() {
    // Make sure that this Schema is registered.
    // An app may call this more than once. Make sure that's harmless.
    if (Schemas.getRegisteredSchema(RobotWorldSchema.name) !== undefined)
      return;

    Schemas.registerSchema(new RobotWorldSchema());
  }

  // Registers all classes of the RobotWorld schema.
  private constructor() {
    super();
    // Register all modules that define classes in this schema.
    // ClassRegistry detects all classes defined by each module and registers them.
    ClassRegistry.registerModule(robots, this);
    ClassRegistry.registerModule(obstacles, this);
    // ... other modules ...
  }

  // Import this schema into a writeable iModel
  public static importSchema(iModelDb: IModelDb) {
    if (RobotWorldSchema.getClass("Robot", iModelDb) !== undefined)
      return;

    if (iModelDb.isReadonly)
      throw new IModelError(IModelStatus.ReadOnly);

    // Must import the schema. The schema must be installed alongside the app in its
    // assets directory. Note that, for portability, make sure the case of
    // the filename is correct!
    iModelDb.importSchema(path.join(IModelHost.appAssetsDir!, "RobotWorld.ecschema.xml"));

    // Insert some pre-defined categories
    const dictionary = iModelDb.models.getModel(IModelDb.dictionaryId) as DictionaryModel;
    const cat: SpatialCategory = SpatialCategory.create(dictionary, _schemaNames.Class.Robot);
    cat.id = iModelDb.elements.insertElement(cat);
    cat.setDefaultAppearance( new Appearance({ color: ColorByName.silver }));
    iModelDb.elements.updateElement(cat);

    const ocat: SpatialCategory = SpatialCategory.create(dictionary, _schemaNames.Class.Barrier);
    ocat.id = iModelDb.elements.insertElement(cat);
    ocat.setDefaultAppearance( new Appearance({ color: ColorByName.brown }));
    iModelDb.elements.updateElement(ocat);
  }

  // Look up the category to use for instances of the specified class
  public static getCategory(iModelDb: IModelDb, className: _schemaNames.Class): SpatialCategory {
    const catid = SpatialCategory.queryCategoryIdByName(iModelDb.models.getModel(IModelDb.dictionaryId) as DictionaryModel, className);
    if (catid === undefined)
      throw new IModelError(IModelStatus.NotFound);
    return iModelDb.elements.getElement(catid) as SpatialCategory;
  }
}

/** Export the schema names so that they appear to be enums nested in the RobotWorldSchema class/ns */
export namespace RobotWorldSchema {
  /** The full names of the classes in the RobotWorld schema */
  export const Class = _schemaNames.Class;

  /** The names of the Categories in the RobotWorld schema */
  export const Category = _schemaNames.Category;

  /** The names of the CodeSpecs in the RobotWorld schema */
  export const CodeSpec = _schemaNames.CodeSpec;
}

// __PUBLISH_EXTRACT_END__
