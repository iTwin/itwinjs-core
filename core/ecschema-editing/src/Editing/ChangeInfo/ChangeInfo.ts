import { SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editor";
import { ChangeOptionProps, ChangeOptions } from "./ChangeOptions";
import { SchemaEditType } from "../SchemaEditType";

/**
 * Defines the function used to revert a specific edit defined by the ISchemaEditChangeInfo type parameter.
 * @alpha
 */
export type SchemaChangeRevertCallback = <T extends ISchemaEditChangeInfo>(changeInfo: T) => Promise<void>;

/**
 * Defines the function used begin (true) or cancel (false) a specific edit operation defined by the ISchemaEditChangeInfo type parameter.
 * @alpha
 */
export type BeginSchemaEditCallback= <T extends ISchemaEditChangeInfo>(changeInfo: T) => Promise<boolean>;

/**
 * @alpha
 */
export interface ISchemaEditChangeProps {
  readonly changeOptions?: ChangeOptionProps;
  readonly editType?: string;
  readonly schemaItemType?: string;
}

/**
 * Defines the properties required for a specific schema edit operation.
 * @alpha
 */
export interface ISchemaEditChangeInfo {
  readonly contextEditor: SchemaContextEditor;
  readonly changeOptions?: ChangeOptions;
  readonly editType: SchemaEditType;
  readonly schemaItemType: SchemaItemType;
  set sequence(value: number)
  get sequence(): number;
  revertChange(): Promise<void>;
}

/**
 * The base class for ISchemaEditChangeInfo implementations. Provides shared functionality for
 * all schema edits.
 * @alpha
 */
export abstract class SchemaEditChangeBase implements ISchemaEditChangeInfo {
  private _sequence: number = -1;

  /** Identifies the unique edit operation using the SchemaEditType enumeration. */
  public abstract readonly editType: SchemaEditType;

  /** The SchemaContextEditor that wraps the SchemaContext for all schema edit operations. */
  public readonly contextEditor: SchemaContextEditor;

  /** The options that control how a specific edit operation is performed. */
  public readonly changeOptions?: ChangeOptions;

  /** The SchemaItemType of the SchemaItem being modified. */
  public readonly schemaItemType: SchemaItemType;

  /** TODO: experimental */
  protected readonly revertCallback?: SchemaChangeRevertCallback;

  /**
   * Initializes a new SchemaEditChangeBase instance.
   * @param contextEditor The SchemaContextEditor that manages all schema edits.
   * @param schemaItemType The type of SchemaItem being modified.
   * @param changeOptions The options that control the edit operation.
   * @param revertCallback The callback used to revert the edit operation.
   */
  constructor(contextEditor: SchemaContextEditor, schemaItemType: SchemaItemType, changeOptions?: ChangeOptions, revertCallback?: SchemaChangeRevertCallback) {
    this.contextEditor = contextEditor;
    this.changeOptions = changeOptions;
    this.schemaItemType = schemaItemType;
    this.revertCallback = revertCallback;

    this.contextEditor.addEditInfo(this);
  }

  /**
   * Gets the sequence number of the edit operation. Used by the SchemaContextEditor to manage edit operations.
   */
  public get sequence(): number {
    return this._sequence;
  }

  /**
   * Sets the sequence number of the edit operation. Managed by the SchemaContextEditor.
   */
  public set sequence(value: number) {
    this._sequence = value;
  }

  /**
   * Accesses the underlying ChangeOptions.localChange property. Indicates an internal edit which bypasses validation, allowing
   * direct modification of the target object or property.
   */
  public get isLocalChange(): boolean {
    return this.changeOptions ? this.changeOptions.localChange : false;
  }

  /**
   * Accesses the underlying ChangeOptions.changeBase property. Indicates that the change should be propagated to
   * base classes and/or properties, if applicable.
   */
  public get changeBase(): boolean {
    return this.changeOptions ? this.changeOptions.changeBase : false;
  }

  /**
   * Accesses the underlying ChangeOptions.changeDerived property. Indicates that the change should be propagated to
   * derived classes and/or properties, if applicable.
   */
  public get changeDerived(): boolean {
    return this.changeOptions ? this.changeOptions.changeDerived: false;
  }

  /**
   * Calls the revertCallback function, reverting the edit operation.
   */
  public async revertChange(): Promise<void> {
    if (!this.revertCallback)
      return;

    await this.revertCallback(this);
  }

  /**
   * Serializes the object to json format.
   */
  public toJson() {
    const itemJson: { [value: string]: any } = {};

  }

  /**
   * Calls the beginChangeCallback function.
   * @returns True if the edit should continue, false otherwise.
   */
  public async beginChange(): Promise<boolean> {
    // Edit continues if no callback is available
    if (!this.changeOptions || !this.changeOptions.beginChangeCallback)
      return true;

    const startEdit = await this.changeOptions.beginChangeCallback(this);
    if (!startEdit) {
      this.contextEditor.changeCancelled(this);
    }
    return startEdit;
  }
}