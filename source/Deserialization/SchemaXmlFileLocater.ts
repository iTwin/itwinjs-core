import { SchemaKey, ECVersion, Schema, SchemaMatchType, SchemaCache, ECObjectsError, ECObjectsStatus, ISchemaLocater } from "../";
import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";

/**
 * A SchemaKey implementation that aids in identifying XML Schema files via the
 * addition of two properties: fileName and schemaXml.  The fileName contains the
 * full path to the file on disk and schemaXml is the full string representation
 * of the Schema XML.
 */
export class XmlSchemaKey extends SchemaKey {
  /**
   * Initializes a new XMLSchemaKey object.
   * @param key The EC SchemaKey identifying the Schema.
   * @param fileName The full path to the Schema XML file.
   * @param schemaXml The string representation of the Schema xml
   * loaded from disk. Optional.
   */
  constructor(key: SchemaKey, fileName: string, schemaXml?: string) {
    super(key.name, key.version);
    this.fileName = fileName;
    this.schemaXml = schemaXml;
  }

  /* The schema file associated with the SchemaKey */
  public fileName: string;
  /* The XML string of the Schema loaded from the file system. */
  public schemaXml?: string;
}

// Temporary work around - need to add format method to string here for now....
declare global {
  interface String {
    format(...params: string[]): string;
    padStartEx(targetLength: number, padString: string): string;
  }
}
String.prototype.format = function() {
  const args = arguments;
  return this.replace(/{(\d+)}/g, (match, theNumber) => {
    return typeof args[theNumber] !== "undefined"
      ? args[theNumber]
      : match;
  });
};

// Temporary work around - need to add padStart method to string here for now...
if (!String.prototype.padStartEx) {
  String.prototype.padStartEx = function padStartEx(targetLength, padString) {
      targetLength = targetLength >> 0; // truncate if number or convert non-number to 0;
      padString = String((typeof padString !== "undefined" ? padString : " "));
      if (this.length > targetLength) {
          return String(this);
      } else {
          targetLength = targetLength - this.length;
          if (targetLength > padString.length) {
              padString += padString.repeat(targetLength / padString.length); // append to original to ensure we are longer than needed
          }
          return padString.slice(0, targetLength) + String(this);
      }
  };
}

/**
 * An SchemaLocater implementation for locating XML Schema files from
 * the file system using configurable search paths.
 */
export class SchemaXmlFileLocater implements ISchemaLocater {
  private _searchPaths: string[];
  private _knownSchemas: SchemaCache;

  /**
   * Initializes a new SchemaXmlFileLocater object.
   */
  constructor() {
    this._knownSchemas = new SchemaCache();
    this._searchPaths = [];
  }

  /**
   * Adds additional search paths used by this locator to find
   * Schema XML files.
   * @param schemaPaths An array of search paths.
   */
  public addSchemaSearchPaths(schemaPaths: string[]) {
    for (const schemaPath of schemaPaths) {
      if (this._searchPaths.find((entry) => entry === schemaPath))
        continue;

      this._searchPaths.push(schemaPath);
    }
  }

  /**
   * Loads an XML Schema from disk as a Promise.
   * @param schemaPath The path to the Schema file.
   */
  public async loadSchema<T extends Schema>(schemaPath: string): Promise<T | undefined> {
    const file = this.getSchemaFile(schemaPath);
    if (!file)
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Could not locate the schema file, ${schemaPath}`);

    this.addSchemaSearchPaths([path.dirname(schemaPath)]);

    const schemaXml = file.toString();
    const key = this.getSchemaKey(schemaXml);
    const foundSchema = this._knownSchemas.getSchemaSync(key, SchemaMatchType.Exact);
    if (foundSchema)
      return foundSchema as T;

    // TODO - bad path
    const schema = new Schema(new XmlSchemaKey(key, schemaPath, schemaXml));
    await this.addSchemaReferences(schema);
    this._knownSchemas.addSchemaSync(schema);
    return schema as T;
  }

  /**
   * Attempts to retrieve a Schema with the given SchemaKey by using the configured search paths
   * to locate the XML Schema file from the file system.
   * @param key The SchemaKey of the Schema to retrieve.
   * @param matchType The SchemaMatchType.
   */
  public async getSchema<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType): Promise<T | undefined> {
    const foundSchema = await this._knownSchemas.getSchema(key, matchType);
    if (foundSchema)
      return foundSchema as T;

    const candidates = this.findEligibleXmlSchemaKeys(key, matchType);
    if (!candidates || candidates.length === 0)
      return undefined;

    const maxCandidate = candidates.sort(this.compareSchemaKeyByVersion)[candidates.length - 1];

    // TODO: Re-implement once references collection is a Promise[].
    /*
    const promise = new Promise<T>(async () => {
      const schema = new Schema(maxCandidate) as T;
      await this.addSchemaReferences(schema);
      this._knownSchemas.addSchema(schema);
      return schema;
    });
    */

    const schema = new Schema(maxCandidate) as T;
    this.addSchemaReferences(schema);
    this._knownSchemas.addSchema(schema);

    return schema;
  }

  /**
   * Gets an array of SchemaKeys of the Schemas referenced by the given Schema.
   * @param xmlSchemaKey The SchemaKey of the parent Schema containing the references.
   */
  public getSchemaReferenceKeys(xmlSchemaKey: XmlSchemaKey): SchemaKey[] {
    let file = xmlSchemaKey.schemaXml;
    if (!file)
      file = this.getSchemaFile(xmlSchemaKey.fileName);

    if (!file)
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Could not locate the schema file, ${xmlSchemaKey.fileName}, for the schema ${xmlSchemaKey.name}`);

    const keys = this._getSchemaReferenceKeys(file.toString());
    return keys;
  }

  /**
   * Adds schemas to the references collection for the given Schema by locating
   * the referenced schemas.
   * @param schema The schema for which to add the references.
   */
  private async addSchemaReferences(schema: Schema) {
    const refKeys = this.getSchemaReferenceKeys(schema.schemaKey as XmlSchemaKey);
    for (const key of refKeys) {
      /* TODO: Re-implement once references collection is an array of Promises.
      const promise = new Promise<Schema>(async () => {
        return await this.getSchema(key, SchemaMatchType.LatestReadCompatible);
      });
      const refSchema = await promise;
      if (refSchema)
        schema.references.push(refSchema);
        */
      const refSchema = await this.getSchema(key, SchemaMatchType.LatestReadCompatible);
      if (refSchema)
        schema.references.push(refSchema);
    }
  }

  /**
   * Reads the schema file at the given location and returns
   * the file buffer.
   * @param schemaPath The paths to the schema to load.
   */
  private getSchemaFile(schemaPath: string): any | undefined {
    if (!fs.existsSync(schemaPath))
      return undefined;

    return fs.readFileSync(schemaPath);
  }

  /**
   * Constructs a SchemaKey based on the information in the Schema XML.
   * @param data The Schema XML as a string.
   */
  private getSchemaKey(data: string): SchemaKey {
    const matches = data.match(/<ECSchema ([^]+?)>/g);
    if (!matches || matches.length !== 1)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `Could not find '<ECSchema>' tag in the given file`);

    const name = matches[0].match(/schemaName="(.+?)"/);
    const version = matches[0].match(/version="(.+?)"/);
    if (!name || name.length !== 2 || !version || version.length !== 2)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `Could not find the ECSchema 'schemaName' or 'version' tag in the given file`);

    const key = new SchemaKey(name[1], ECVersion.fromString(version[1]));
    return key;
  }

  /**
   * Gets an array of SchemaKeys of the Schemas referenced by the given Schema.
   * @param data The Schema XML string.
   */
  private _getSchemaReferenceKeys(data: string): SchemaKey[] {
    const keys: SchemaKey[] = [];
    const matches = data.match(/<ECSchemaReference ([^]+?)\/>/g);
    if (!matches)
      return keys;

    for (const match of matches) {
      const name = match.match(/name="(.+?)"/);
      const versionMatch = match.match(/version="(.+?)"/);
      if (!name || name.length !== 2 || !versionMatch || versionMatch.length !== 2)
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `Invalid ECSchemaReference xml encountered in the schema file`);

      // minor version maybe missing, so add "0"
      let versionString = versionMatch[1];
      const versionParts = versionString.split(".");
      if (versionParts.length === 2)
        versionParts.push("0");
      versionString = versionParts.join(".");

      const key = new SchemaKey(name[1], ECVersion.fromString(versionString));
      keys.push(key);
    }

    return keys;
  }

  /**
   * Compares two Schema versions.  If the left-hand version is greater, 1 is returned. If the
   * left-hand version is less, -1 us returned.  If the versions are an exact match, 0 is returned.
   * @param lhs The 'left-hand' SchemaKey.
   * @param rhs The 'right-hand' SchemaKey.
   */
  private compareSchemaKeyByVersion(lhs: XmlSchemaKey, rhs: XmlSchemaKey): number {
    return lhs.compareByVersion(rhs);
  }

  /**
   * Attempts the find all Schema files in the configurable search paths that match
   * the desired SchemaKey.
   * @param desiredKey The SchemaKey to match.
   * @param matchType The SchemaMatchType.
   */
  private findEligibleXmlSchemaKeys(desiredKey: SchemaKey, matchType: SchemaMatchType): XmlSchemaKey[] {
    const foundFiles: XmlSchemaKey[] = [];
    let twoVersionSuffix: string;
    let threeVersionSuffix: string;
    const readVersion = desiredKey.readVersion.toString();
    const writeVersion = desiredKey.writeVersion.toString();
    const minorVersion = desiredKey.minorVersion.toString();

    if (matchType === SchemaMatchType.Latest) {
      twoVersionSuffix = ".*.*.ecschema.xml";
      threeVersionSuffix = ".*.*.*.ecschema.xml";
    } else if (matchType === SchemaMatchType.LatestWriteCompatible) {
      twoVersionSuffix = ".{0}.*.ecschema.xml".format(readVersion.padStartEx(2, "0"));
      threeVersionSuffix = ".{0}.{1}.*.ecschema.xml".format(readVersion.padStartEx(2, "0"), writeVersion.padStartEx(2, "0"));
    } else if (matchType === SchemaMatchType.LatestReadCompatible) {
      twoVersionSuffix = ".{0}.*.ecschema.xml".format(readVersion.padStartEx(2, "0"));
      threeVersionSuffix = ".{0}.*.*.ecschema.xml".format(readVersion.padStartEx(2, "0"));
    } else {
      twoVersionSuffix = ".{0}.{1}.ecschema.xml".format(readVersion.padStartEx(2, "0"), writeVersion.padStartEx(2, "0"));
      threeVersionSuffix = ".{0}.{1}.{2}.ecschema.xml".format(readVersion.padStartEx(2, "0"), writeVersion.padStartEx(2, "0"),
                            minorVersion.padStartEx(2, "0"));
    }

    const twoVersionExpression = desiredKey.name + twoVersionSuffix;
    const threeVersionExpression = desiredKey.name + threeVersionSuffix;

    for (const searchPath of this._searchPaths) {
      this.addCandidateNoExtSchemaKey(foundFiles, searchPath, desiredKey.name, desiredKey, matchType);
      this.addCandidateSchemaKeys(foundFiles, searchPath, twoVersionExpression, desiredKey, matchType);
      this.addCandidateSchemaKeys(foundFiles, searchPath, threeVersionExpression, desiredKey, matchType);
    }

    return foundFiles;
  }

  /**
   * Adds SchemaKeys to the provided foundFiles collection that match the desired SchemaKey.
   * @param foundFiles The collection of SchemaKeys found in the given directory.
   * @param schemaPath The directory in which to search for the Schemas.
   * @param fileFilter The file filter, potentially with wildcards, used to locates the Schema files.
   * @param desiredKey The SchemaKey used to find matching Schema files.
   * @param matchType The SchemaMatchType to use when comparing the desiredKey and the keys found during the search.
   */
  private addCandidateSchemaKeys(foundFiles: XmlSchemaKey[], schemaPath: string, fileFilter: string, desiredKey: SchemaKey, matchType: SchemaMatchType) {
    const fullPath = path.join(schemaPath, fileFilter);

    const result = new glob.GlobSync(fullPath, {sync: true});
    for (const match of result.found) {
      let fileName = path.basename(match, ".ecschema.xml");
      // TODO: should this be moved or handled elsewhere?
      // Handles two version file names - SchemaKey.parseString supports only 3 version names.
      if (/[^\d]\.\d?\d\.\d?\d$/.test(fileName))
        fileName = fileName + ".00";

      const schemaKey = SchemaKey.parseString(fileName);

      const file = fs.readFileSync(match);
      if (!file)
        continue;

      if (schemaKey.matches(desiredKey, matchType)) {
        foundFiles.push(new XmlSchemaKey(schemaKey, match, file.toString()));
      }
    }
  }

  /**
   * Adds SchemaKeys to the provided foundFiles collection that match the desired SchemaKey. This method
   * only attempts to find schema files that have no version in the file name.
   * @param foundFiles The collection of SchemaKeys found in the given directory.
   * @param schemaPath The directory in which to search for the Schemas.
   * @param schemaName The short name of the Schema (without version).
   * @param desiredKey The SchemaKey used to find matching Schema files.
   * @param matchType The SchemaMatchType to use when comparing the desiredKey and the keys found during the search.
   */
  private addCandidateNoExtSchemaKey(foundFiles: XmlSchemaKey[], schemaPath: string, schemaName: string, desiredKey: SchemaKey, matchType: SchemaMatchType) {
    const fullPath = path.join(schemaPath, schemaName + ".ecschema.xml");
    if (!fs.existsSync(fullPath))
      return;

    const file = fs.readFileSync(fullPath);
    if (!file)
      return;

    const key = this.getSchemaKey(file.toString());
    if (key.matches(desiredKey, matchType))
      foundFiles.push(new XmlSchemaKey(key, fullPath, file.toString()));
  }
}
