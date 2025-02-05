import { SchemaItemType } from "@itwin/ecschema-metadata";
import { EditOptions } from "./EditOptions";
import { SchemaEditType } from "../SchemaEditType";


/**
 * Defines the function used begin (true) or cancel (false) a specific edit operation defined by the ISchemaEditInfo type parameter.
 * @alpha
 */
export type BeginSchemaEditCallback = <T extends ISchemaEditInfo>(changeInfo: T) => Promise<boolean>;

/**
 * Defines the function to be called when an edit operation is cancelled.
 * @alpha
 */
export type OnEditCancelled = <T extends ISchemaEditInfo>(changeInfo: T) => Promise<void>;

/**
 * Defines the properties required for a specific schema edit operation.
 * @alpha
 */
export interface ISchemaEditInfo {
  readonly editOptions?: EditOptions;
  readonly editType: SchemaEditType;
  readonly schemaItemType: SchemaItemType;
}

/**
 * The base class for ISchemaEditInfo implementations. Provides shared functionality for
 * all schema edits.
 * @alpha
 */
export abstract class SchemaEditInfoBase implements ISchemaEditInfo {

  /** Identifies the unique edit operation using the SchemaEditType enumeration. */
  public abstract readonly editType: SchemaEditType;

  /** The options that control how a specific edit operation is performed. */
  public readonly editOptions?: EditOptions;

  /** The SchemaItemType of the SchemaItem being modified. */
  public readonly schemaItemType: SchemaItemType;

  /**
   * Initializes a new SchemaEditInfoBase instance.
   * @param schemaItemType The type of SchemaItem being modified.
   * @param editOptions The options that control the edit operation.
   */
  constructor(schemaItemType: SchemaItemType, editOptions?: EditOptions) {
    this.editOptions = editOptions;
    this.schemaItemType = schemaItemType;
  }

  /**
   * Accesses the underlying EditOptions.localChange property. Indicates an internal edit which bypasses validation, allowing
   * direct modification of the target object or property.
   */
  public get isLocalChange(): boolean {
    return this.editOptions ? this.editOptions.localChange : false;
  }

  /**
   * Accesses the underlying EditOptions.changeBase property. Indicates that the change should be propagated to
   * base classes and/or properties, if applicable.
   */
  public get changeBase(): boolean {
    return this.editOptions ? this.editOptions.changeBase : false;
  }

  /**
   * Accesses the underlying EditOptions.changeDerived property. Indicates that the change should be propagated to
   * derived classes and/or properties, if applicable.
   */
  public get changeDerived(): boolean {
    return this.editOptions ? this.editOptions.changeDerived : false;
  }
}