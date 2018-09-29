/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ClassRegistry, Schema, Schemas, IModelDb, DictionaryModel, SpatialCategory, IModelHost } from "@bentley/imodeljs-backend";
import { IModelError, IModelStatus } from "@bentley/imodeljs-common";
import * as path from "path";
import * as _schemaNames from "../common/AnalysisSchema";

// __PUBLISH_EXTRACT_START__ ClassRegistry.registerModule

// Import all modules that define classes in this schema.
import * as AnalysisMesh from "./AnalysisElement";

import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
// ... other modules ...

/** An example of defining a class that represents a schema.
 * Important: The name of the TypeScript class must match the name of the ECSchema that it represents.
 * Normally, you would use a tool to generate a TypeScript schema class like this from an ECSchema
 * definition. You would then edit the generated TypeScript class to add methods.
 */
export class AnalysisSchema extends Schema {
    /** An app must call this to register the Analysis schema prior to using it. */
    public static registerSchema() {
        // Make sure that this Schema is registered.
        // An app may call this more than once. Make sure that's harmless.
        if (Schemas.getRegisteredSchema(AnalysisSchema.name) !== undefined)
            return;

        Schemas.registerSchema(new AnalysisSchema());
    }

    // Registers all classes of the Analysis schema.
    private constructor() {
        super();
        // Register all modules that define classes in this schema.
        // ClassRegistry detects all classes defined by each module and registers them.
        ClassRegistry.registerModule(AnalysisMesh, this);
    }

    // ...

    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ IModelDb.importSchema

    // Import the Analysis schema into the specified iModel.
    // Also do some one-time bootstrapping of supporting definitions such as Categories.
    public static async importSchema(activityContext: ActivityLoggingContext, iModelDb: IModelDb): Promise<void> {
        activityContext.enter();
        if (iModelDb.containsClass(_schemaNames.Class.Mesh))
            return Promise.resolve();

        if (iModelDb.isReadonly)
            throw new IModelError(IModelStatus.ReadOnly);

        // Must import the schema. The schema must be installed alongside the app in its
        // assets directory. Note that, for portability, make sure the case of
        // the filename is correct!
        await iModelDb.importSchema(activityContext, path.join(IModelHost.appAssetsDir!, "Analysis.ecschema.xml"));
        activityContext.enter();

        // This is the right time to create definitions, such as Categories, that will
        // be used with the classes in this schema.
        AnalysisSchema.bootStrapDefinitions(iModelDb);

        return Promise.resolve();
    }
    // __PUBLISH_EXTRACT_END__

    public static bootStrapDefinitions(iModelDb: IModelDb) {
        // Insert some pre-defined categories
        const dictionary = iModelDb.models.getModel(IModelDb.dictionaryId) as DictionaryModel;

        const cat: SpatialCategory = SpatialCategory.create(dictionary, _schemaNames.Class.Mesh);
        cat.id = iModelDb.elements.insertElement(cat);
    }

    // Look up the category to use for instances of the specified class
    public static getCategory(iModelDb: IModelDb, className: _schemaNames.Class): SpatialCategory {
        const categoryId = SpatialCategory.queryCategoryIdByName(iModelDb, IModelDb.dictionaryId, className);
        if (categoryId === undefined)
            throw new IModelError(IModelStatus.NotFound);
        return iModelDb.elements.getElement(categoryId) as SpatialCategory;
    }

}

/** Export the schema names so that they appear to be enums nested in the AnalysisSchema class/ns */
export namespace Analysis {
    /** The full names of the classes in the Analysis schema */
    export const Class = _schemaNames.Class;

    /** The names of the Categories in the Analysis schema */
    export const Category = _schemaNames.Category;

    /** The names of the CodeSpecs in the Analysis schema */
    export const CodeSpec = _schemaNames.CodeSpec;
}
