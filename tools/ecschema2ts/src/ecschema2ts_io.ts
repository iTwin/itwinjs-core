/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as fs from "fs";
import { ECObjectsError, ECObjectsStatus, ECVersion, ISchemaLocater, Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { FileSchemaKey, SchemaFileLocater, SchemaJsonFileLocater } from "@itwin/ecschema-locaters";
import { DOMParser } from "@xmldom/xmldom";
import { ECSchemaXmlContext, IModelHost } from "@itwin/core-backend";
import { ECSchemaToTs } from "./ecschema2ts";

const unitsSchemaKey = new SchemaKey("Units", 1, 0, 0);
const formatsSchemaKey = new SchemaKey("Formats", 1, 0, 0);

/**
 * The class is used to parse xml file by using native context. It converts the xml schema
 * to json schema and then, use Typescript side json deserialization to convert it to schema object.
 * @beta
 */
class SchemaBackendFileLocater extends SchemaFileLocater implements ISchemaLocater {
  private _nativeContext: ECSchemaXmlContext;

  public constructor(nativeContext: ECSchemaXmlContext) {
    super();
    this._nativeContext = nativeContext;
  }

  /**
   * Async version of getSchemaSync()
   * @param key The schema key needed to locate the schema in the search path
   * @param matchType The SchemaMatchType
   * @param context The schema context used to parse schema
   */
  public async getSchema<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<T | undefined> {
    return this.getSchemaSync(key, matchType, context) as T;
  }

  /**
   * Attempt to retrieve a schema with the given schema key by using the configured search path.
   * @param key The schema key needed to locate the schema in the search path
   * @param matchType The SchemaMatchType
   * @param context The schema context used to parse schema
   */
  public getSchemaSync<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): T | undefined {
    const localPath: Set<string> = new Set<string>();
    return this.getSchemaRecursively(key, matchType, context, localPath);
  }

  /**
   * Retrieve the schema key from schema Xml file. It looks very similar to `SchemaXmlFileLocater.getSchemaKey(string):SchemaKey` but not quite.
   * Because the schema version in 3.1 and below doesn't contain write version, we will have to manually add
   * 0 as a write version for it before converting to schema key
   * @param data content of the schema Xml file
   */
  public getSchemaKey(data: string): SchemaKey {
    const matches = data.match(/<ECSchema ([^]+?)>/g);
    if (!matches || matches.length !== 1)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `Could not find '<ECSchema>' tag in the given file`);

    // parse name and version
    const name = matches[0].match(/schemaName="(.+?)"/);
    const version = matches[0].match(/version="(.+?)"/);
    if (!name || name.length !== 2 || !version || version.length !== 2)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `Could not find the ECSchema 'schemaName' or 'version' tag in the given file`);

    const versionStr: string = this.resolveECVersionString(version[1]);
    const key = new SchemaKey(name[1], ECVersion.fromString(versionStr));
    return key;
  }

  /**
   * Attempt to retrieve a schema with the given schema key by using the configured search path. The locater will attempt to parse all the references first
   * before parsing the current schema. That way, both the native and ts side context will have all references needed to parse the current schema.
   * In case of cyclic dependency, it will throw error
   * @param key The schema key needed to locate the schema in the search path
   * @param matchType The SchemaMatchType
   * @param context The schema context used to parse schema
   * @param localPath The path of the recursion is following used to detect cyclic dependency
   */
  private getSchemaRecursively<T extends Schema>(key: SchemaKey, matchType: SchemaMatchType, context: SchemaContext, localPath: Set<string>): T | undefined {
    // load the schema file
    const candidates: FileSchemaKey[] = this.findEligibleSchemaKeys(key, matchType, "xml");
    if (0 === candidates.length)
      return undefined;

    const maxCandidate = candidates.sort(this.compareSchemaKeyByVersion)[candidates.length - 1];
    const schemaPath = maxCandidate.fileName;
    if (undefined === this.fileExistsSync(schemaPath))
      return undefined;

    // mark that schema is already visited
    const schemaKeyName = maxCandidate.toString();
    localPath.add(schemaKeyName);

    // resolve all the references before beginning parsing the current schema
    const domParser: DOMParser = new DOMParser();
    const schemaXmlDocument: Document = domParser.parseFromString(fs.readFileSync(schemaPath, "utf8"));
    const referenceKeys: SchemaKey[] = this.getReferenceSchemaKeys(schemaXmlDocument);
    for (const referenceKey of referenceKeys) {
      const referenceKeyName = referenceKey.toString();

      // jump to the next reference if it is not visited. If it is, check if the current schema refers back to other visited schema node
      if (undefined === context.getSchemaSync(referenceKey, matchType)) {
        const referenceSchema = this.getSchemaRecursively(referenceKey, SchemaMatchType.LatestWriteCompatible, context, localPath);
        if (!referenceSchema) {
          throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema,
            `Could not locate reference schema, ${referenceKey.name}.${referenceKey.version.toString()} of schema ${key.name}.${key.version.toString()}`);
        }
      } else if (localPath.has(referenceKeyName)) {
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `Schema ${schemaKeyName} and ${referenceKeyName} form cyclic dependency`);
      }
    }

    localPath.delete(schemaKeyName);

    // it should be safe to parse the current schema because all the references are in the native context and the TS side schema context at this point
    const schemaJson = this._nativeContext.readSchemaFromXmlFile(schemaPath);
    return Schema.fromJsonSync(schemaJson, context) as T;
  }

  /**
   * Retrieve the reference schema keys by parsing the current Schema XML DOM
   * @param schemaXmlDocument Current schema XML DOM document
   */
  private getReferenceSchemaKeys(schemaXmlDocument: Document): SchemaKey[] {
    const referenceDocuments = schemaXmlDocument.getElementsByTagName("ECSchemaReference");
    const referenceSchemaKeys: SchemaKey[] = [];

    // unfortunately, for-of loop cannot work with HTMLCollectionOf<Element> type here
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < referenceDocuments.length; ++i) {
      const element = referenceDocuments[i];
      const name = this.getRequiredXmlAttribute(element, "name",
        "The schema has an invalid ECSchemaReference attribute. One of the reference is missing the 'name' attribute");
      let version = this.getRequiredXmlAttribute(element, "version",
        "The schema has an invalid ECSchemaReference attribute. One of the reference is missing the 'version' attribute");
      version = this.resolveECVersionString(version);

      const key = new SchemaKey(name, ECVersion.fromString(version));
      referenceSchemaKeys.push(key);
    }

    return referenceSchemaKeys;
  }

  /**
   * Retrieve the value of the attribute in the DOM Element
   * @param xmlElement The DOM Element
   * @param attribute The required attribute name of the DOM Element
   * @param errorMessage The error message if there is no attribute found in the DOM Element
   */
  private getRequiredXmlAttribute(xmlElement: Element, attribute: string, errorMessage: string): string {
    const value = xmlElement.getAttribute(attribute);
    if (!value)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, errorMessage);

    return value;
  }

  /**
   * Attempt to check the ECVersion. If the ECVersion contains only read and minor version, it will add 00 to the write version.
   * Error will be thrown if the version format doesn't contain at least the read and minor version
   * @param version raw ECVersion string retrieved from the Schema XML DOM Element
   */
  private resolveECVersionString(version: string): string {
    // check that version at leasts contain read and write number. If so, add 00 to the minor version if there is none existed in the version
    let versionNumbers: string[] = version.split(".");
    if (versionNumbers.length < 2)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `'version' number does not at least have read and minor number in the given file`);
    else if (versionNumbers.length === 2) {
      versionNumbers.push("00");
      const [readNumber, minorNumber, writeNumber] = versionNumbers;
      versionNumbers = [readNumber, writeNumber, minorNumber];
    }

    return versionNumbers.join(".");
  }
}

/**
 * Deserializes ECXml and ECJson schema files.
 */
class SchemaDeserializer {
  /**
   * Deserializes the specified ECXml schema file in the given schema context.
   * @param schemaFilePath The path to a valid ECXml schema file.
   * @param schemaContext The schema context in which to deserialize the schema.
   * @param referencePaths Optional paths to search when locating schema references.
   */
  public async deserializeXmlFile(schemaFilePath: string, schemaContext: SchemaContext, referencePaths?: string[]): Promise<Schema> {
    // If the schema file doesn't exist, throw an error
    if (!fs.existsSync(schemaFilePath))
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Unable to locate schema XML file at ${schemaFilePath}`);

    await IModelHost.startup();

    // add reference paths to the native context
    if (undefined === referencePaths)
      referencePaths = [];
    referencePaths.push(path.dirname(schemaFilePath));

    const nativeContext = new ECSchemaXmlContext();
    const locater = new SchemaBackendFileLocater(nativeContext);
    for (const refPath of referencePaths) {
      locater.addSchemaSearchPath(refPath);
      nativeContext.addSchemaPath(refPath);
    }

    // parsing the current xml schema
    let schema: Schema | undefined;
    try {
      const schemaKey = locater.getSchemaKey(fs.readFileSync(schemaFilePath, "utf8"));

      // Units and Formats have to be added to the ts side context first because the native context will add them automatically to
      // the schema as references even if the schema does not use them
      if (!schemaKey.compareByName(unitsSchemaKey) && !schemaKey.compareByName(formatsSchemaKey)) {
        locater.getSchemaSync(unitsSchemaKey, SchemaMatchType.LatestWriteCompatible, schemaContext);
        locater.getSchemaSync(formatsSchemaKey, SchemaMatchType.LatestWriteCompatible, schemaContext);
      }

      schema = locater.getSchemaSync(schemaKey, SchemaMatchType.Exact, schemaContext);
    } finally {
      await IModelHost.shutdown();
    }

    return schema!;
  }

  /**
   * Deserializes the specified ECJson schema file in the given schema context.
   * @param schemaFilePath The path to a valid ECJson schema file.
   * @param context The schema context in which to deserialize the schema.
   * @param referencePaths Optional paths to search when locating schema references.
   */
  public deserializeJsonFile(schemaFilePath: string, context: SchemaContext, referencePaths?: string[]): Schema {
    // If the schema file doesn't exist, throw an error
    if (!fs.existsSync(schemaFilePath))
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Unable to locate schema JSON file at ${schemaFilePath}`);

    // add locater to the context
    if (!referencePaths)
      referencePaths = [];
    referencePaths.push(path.dirname(schemaFilePath));

    const locater = new SchemaJsonFileLocater();
    locater.addSchemaSearchPaths(referencePaths);
    context.addLocater(locater);

    // If the file cannot be parsed, throw an error.
    const schemaString = fs.readFileSync(schemaFilePath, "utf8");
    let schemaJson: any;
    try {
      schemaJson = JSON.parse(schemaString);
    } catch (e: any) {
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, e.message);
    }
    return Schema.fromJsonSync(schemaJson, context);
  }
}

/**
 * Abstract interface to write the result of converting schema file to ts to different output (files, stdout, and so on).
 * Schema file path can be json or xml or both or an obscured file format depending how the concrete class interprets it.
 */
export interface ECSchemaToTsFileWriter {
  convertSchemaFile(context: SchemaContext, schemaPath: string, referencePaths?: string[]): Promise<string>;
}

/**
 * Concrete class to write ecschema2ts result to file
 */
export class ECSchemaToTsXmlWriter implements ECSchemaToTsFileWriter {
  private _ecschema2ts: ECSchemaToTs;
  private _deserializer: SchemaDeserializer;
  private _outdir: string;

  public constructor(outdir: string) {
    this._ecschema2ts = new ECSchemaToTs();
    this._deserializer = new SchemaDeserializer();
    this._outdir = outdir;
  }

  /**
   * Given a valid schema file path, the converted typescript files will be
   * created in the provided output directory. If the output directory does not exist the file will not be
   * created.
   * @param context Schema context used to find reference schema
   * @param schemaPath The full path to the ECSchema xml file
   * @param outdir The path to the directory to write the generated typescript file.
   */
  public async convertSchemaFile(context: SchemaContext, schemaPath: string, referencePaths?: string[]): Promise<string> {
    // check if outdir is correct path
    if (!this._outdir)
      throw new Error(`The out directory ${this._outdir} is invalid.`);

    this._outdir = path.normalize(this._outdir) + path.sep;
    if (!fs.existsSync(this._outdir))
      throw new Error(`The out directory ${this._outdir} does not exist.`);

    // convert schema to typescript String
    const schema = await this._deserializer.deserializeXmlFile(schemaPath, context, referencePaths);
    const tsString = this._ecschema2ts.convertSchemaToTs(schema);
    const schemaTsString = tsString.schemaTsString;
    const elemTsString = tsString.elemTsString;
    const propsTsString = tsString.propsTsString;

    // write to file
    let createdFilesLog: string = "";

    const schemaFile = `${this._outdir}${schema.schemaKey.name}.ts`;
    fs.writeFileSync(schemaFile, schemaTsString);
    createdFilesLog += `Successfully created typescript file, "${schemaFile}".\r\n`;

    const elemFile = `${this._outdir}${schema.schemaKey.name}Elements.ts`;
    fs.writeFileSync(elemFile, elemTsString);
    createdFilesLog += `Successfully created typescript file, "${elemFile}".\r\n`;

    const propsElemFile = `${this._outdir}${schema.schemaKey.name}ElementProps.ts`;
    fs.writeFileSync(propsElemFile, propsTsString);
    createdFilesLog += `Successfully created typescript file, "propsElemFile".\r\n`;

    return createdFilesLog;
  }
}
