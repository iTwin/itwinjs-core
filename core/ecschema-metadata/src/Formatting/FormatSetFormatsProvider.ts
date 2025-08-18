import { BeEvent } from "@itwin/core-bentley";
import { FormatDefinition, FormatsChangedArgs, FormatsProvider, MutableFormatsProvider } from "@itwin/core-quantity";
import { FormatSet } from "../Deserialization/JsonProps";

/**
 * A mutable format provider that manages format definitions within a format set.
 * When formats are added or removed, the underlying format set is automatically updated.
 * @beta
 */
export class FormatSetFormatsProvider implements MutableFormatsProvider {
  public onFormatsChanged: BeEvent<(args: FormatsChangedArgs) => void> = new BeEvent<(args: FormatsChangedArgs) => void>();

  private _formatSet: FormatSet;
  private _fallbackProvider?: FormatsProvider;

  public constructor(formatSet: FormatSet, fallbackProvider?: FormatsProvider) {
    this._formatSet = formatSet;
    this._fallbackProvider = fallbackProvider;
  }

  public async addFormat(name: string, format: FormatDefinition): Promise<void> {
    this._formatSet.formats[name] = format;
    this.onFormatsChanged.raiseEvent({ formatsChanged: [name] });
  }

  public clearFallbackProvider(): void {
    this._fallbackProvider = undefined;
  }

  public async getFormat(name: string): Promise<FormatDefinition | undefined> {
    const format = this._formatSet.formats[name];
    if (format) return format;
    if (this._fallbackProvider) return this._fallbackProvider.getFormat(name);
    return undefined;
  }

  public async removeFormat(name: string): Promise<void> {
    delete this._formatSet.formats[name];
    this.onFormatsChanged.raiseEvent({ formatsChanged: [name] });
  }
}
