import { BeEvent } from "@itwin/core-bentley";
import { FormatDefinition, FormatsChangedArgs, FormatsProvider, MutableFormatsProvider } from "@itwin/core-quantity";
import { FormatSet } from "../Deserialization/JsonProps";
import { SchemaItem } from "../Metadata/SchemaItem";

/**
 * A mutable format provider that manages format definitions within a format set.
 * When formats are added or removed, the underlying format set is automatically updated.
 * @beta
 */
export class FormatSetFormatsProvider implements MutableFormatsProvider {
  public onFormatsChanged: BeEvent<(args: FormatsChangedArgs) => void> = new BeEvent<(args: FormatsChangedArgs) => void>();

  private _formatSet: FormatSet;
  private _fallbackProvider?: FormatsProvider;

  public constructor(props: {formatSet: FormatSet, fallbackProvider?: FormatsProvider}) {
    this._formatSet = props.formatSet;
    this._fallbackProvider = props.fallbackProvider;
  }

  /**
   * Adds a format definition to the format set or updates an existing one.
   * @param name The name of the format to add or update
   * @param format The format definition to add or update
   */
  public async addFormat(name: string, format: FormatDefinition): Promise<void> {
    this._formatSet.formats[name] = format;
    this.onFormatsChanged.raiseEvent({ formatsChanged: [name] });
  }

  /**
   * Clears the fallback provider, if one is set.
   */
  public clearFallbackProvider(): void {
    this._fallbackProvider = undefined;
  }

  /**
   * Retrieves a format definition by its name from the format set. If not found, it checks the fallback provider to find the format, else returns undefined.
   */
  public async getFormat(input: string): Promise<FormatDefinition | undefined> {
    // Normalizes any schemaItem names coming from node addon 'schemaName:schemaItemName' -> 'schemaName.schemaItemName'
    const [schemaName, itemName] = SchemaItem.parseFullName(input);

    const name = (schemaName === "") ? itemName : `${schemaName}.${itemName}`;
    const format = this._formatSet.formats[name];
    if (format) return format;
    if (this._fallbackProvider) return this._fallbackProvider.getFormat(name);
    return undefined;
  }

  /**
   * Removes a format definition from the format set.
   * @param name The name of the format to remove
   */
  public async removeFormat(name: string): Promise<void> {
    delete this._formatSet.formats[name];
    this.onFormatsChanged.raiseEvent({ formatsChanged: [name] });
  }
}
