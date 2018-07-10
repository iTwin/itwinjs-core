/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { ClassRegistry, Schema, Schemas, IModelDb, DictionaryModel, SpatialCategory, IModelHost } from "@bentley/imodeljs-backend";
import { IModelError, IModelStatus, SubCategoryAppearance, ColorByName } from "@bentley/imodeljs-common";
import * as path from "path";
import * as _schemaNames from "../common/RobotWorldSchema";

// __PUBLISH_EXTRACT_START__ ClassRegistry.registerModule

// Import all modules that define classes in this schema.
import * as robots from "./RobotElement";
import * as obstacles from "./BarrierElement";
// ... other modules ...

/** An example of defining a class that represents a schema.
 * Important: The name of the TypeScript class must match the name of the ECSchema that it represents.
 * Normally, you would use a tool to generate a TypeScript schema class like this from an ECSchema
 * definition. You would then edit the generated TypeScript class to add methods.
 */
export class RobotWorld extends Schema {
  /** An app must call this to register the RobotWorld schema prior to using it. */
  public static registerSchema() {
    // Make sure that this Schema is registered.
    // An app may call this more than once. Make sure that's harmless.
    if (Schemas.getRegisteredSchema(RobotWorld.name) !== undefined)
      return;

    Schemas.registerSchema(new RobotWorld());
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

  // ...

  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ IModelDb.importSchema

  // Import the RobotWorld schema into the specified iModel.
  // Also do some one-time bootstrapping of supporting definitions such as Categories.
  public static importSchema(iModelDb: IModelDb) {
    if (iModelDb.containsClass(_schemaNames.Class.Robot))
      return;

    if (iModelDb.isReadonly())
      throw new IModelError(IModelStatus.ReadOnly);

    // Must import the schema. The schema must be installed alongside the app in its
    // assets directory. Note that, for portability, make sure the case of
    // the filename is correct!
    iModelDb.importSchema(path.join(IModelHost.appAssetsDir!, "RobotWorld.ecschema.xml"));

    // This is the right time to create definitions, such as Categories, that will
    // be used with the classes in this schema.
    RobotWorld.bootStrapDefinitions(iModelDb);
  }
  // __PUBLISH_EXTRACT_END__

  private static bootStrapDefinitions(iModelDb: IModelDb) {
    // Insert some pre-defined categories
    const dictionary = iModelDb.models.getModel(IModelDb.dictionaryId) as DictionaryModel;

    if (true) {
  // __PUBLISH_EXTRACT_START__ Element.createSpatialCategory.example-code
      const cat: SpatialCategory = SpatialCategory.create(dictionary, _schemaNames.Class.Robot);
      cat.id = iModelDb.elements.insertElement(cat);
      cat.setDefaultAppearance(new SubCategoryAppearance({ color: ColorByName.silver }));
      iModelDb.elements.updateElement(cat);
  // __PUBLISH_EXTRACT_END__
    }

    if (true) {
      const cat: SpatialCategory = SpatialCategory.create(dictionary, _schemaNames.Class.Barrier);
      cat.id = iModelDb.elements.insertElement(cat);
      cat.setDefaultAppearance(new SubCategoryAppearance({ color: ColorByName.brown }));
      iModelDb.elements.updateElement(cat);
    }
  }

  // Look up the category to use for instances of the specified class
  public static getCategory(iModelDb: IModelDb, className: _schemaNames.Class): SpatialCategory {
    const categoryId = SpatialCategory.queryCategoryIdByName(iModelDb, IModelDb.dictionaryId, className);
    if (categoryId === undefined)
      throw new IModelError(IModelStatus.NotFound);
    return iModelDb.elements.getElement(categoryId) as SpatialCategory;
  }

}

/** Export the schema names so that they appear to be enums nested in the RobotWorldSchema class/ns */
export namespace RobotWorld {
  /** The full names of the classes in the RobotWorld schema */
  export const Class = _schemaNames.Class;

  /** The names of the Categories in the RobotWorld schema */
  export const Category = _schemaNames.Category;

  /** The names of the CodeSpecs in the RobotWorld schema */
  export const CodeSpec = _schemaNames.CodeSpec;
}
