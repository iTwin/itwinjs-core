/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { flatbuffers } from "flatbuffers";
import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import { Code, IModel } from "@itwin/core-common";
import { IModelDb } from "../../IModelDb";
import { EditTxn } from "../../EditTxn";

// Writes the deprecated TextAnnotation flatbuffers (see Annotations.fbs in imodel-native) so tests can create legacy annotations.

/** Values of AnnotationColorType. */
export enum LegacyColorType { byCategory = 1, rgba = 2, viewBackground = 3 }

/** Keys of AnnotationTextStyleProperty. */
export enum TextStyleKey {
  colorType = 1, colorValue = 2, fontId = 3, height = 4, lineSpacingFactor = 5, isBold = 6, isItalic = 7, isUnderlined = 8,
  stackedFractionScale = 9, stackedFractionType = 10, subScriptOffsetFactor = 11, subScriptScale = 12,
  superScriptOffsetFactor = 13, superScriptScale = 14, widthFactor = 15,
}
const textStyleRealKeys = new Set<number>([4, 5, 9, 11, 12, 13, 14, 15]);

/** Keys of AnnotationFrameStyleProperty. */
export enum FrameStyleKey {
  cloudBulgeFactor = 1, cloudDiameterFactor = 2, fillColorType = 3, fillColorValue = 4, fillTransparency = 5, horizontalPadding = 6,
  isFillEnabled = 7, isStrokeCloud = 8, isStrokeEnabled = 9, strokeColorType = 10, strokeColorValue = 11, strokeWeight = 12, type = 13,
  verticalPadding = 14,
}
const frameStyleRealKeys = new Set<number>([1, 2, 5, 6, 14]);

/** Values of AnnotationFrameType. */
export enum LegacyFrameType { invisibleBox = 1, box = 2, circle = 3, ellipse = 4 }

/** Keys of AnnotationLeaderStyleProperty. */
export enum LeaderStyleKey {
  lineColorType = 1, lineColorValue = 2, lineType = 3, lineWeight = 4, terminatorColorType = 5, terminatorColorValue = 6,
  terminatorScaleFactor = 7, terminatorType = 8, terminatorWeight = 9,
}
const leaderStyleRealKeys = new Set<number>([7]);

/** Values of AnnotationLeaderLineType and AnnotationLeaderTerminatorType. */
export enum LegacyLeaderLineType { none = 1, straight = 2, curved = 3 }
export enum LegacyTerminatorType { none = 1, openArrow = 2, closedArrow = 3 }

/** Values of AnnotationStackedFractionType and AnnotationTextBlock::HorizontalJustification. */
export enum LegacyStackedFractionType { horizontal = 1, diagonal = 2 }
export enum LegacyJustification { left = 1, center = 2, right = 3 }

/** Keys of AnnotationTextBlockProperty. */
enum TextBlockKey { documentWidth = 1, justification = 2 }

/** A property key and its value. Integer properties include booleans (0 or 1), enum values, colors, and IDs. */
export type LegacySetters = Array<[key: number, value: number | Id64String]>;

export interface LegacyRunFixture {
  type: "text" | "fraction" | "lineBreak" | "invalid";
  styleId: Id64String;
  overrides?: LegacySetters;
  content?: string;
  numerator?: string;
  denominator?: string;
  subSuperScript?: "none" | "sub" | "super";
}

export interface LegacyTextAnnotationFixture {
  document?: {
    styleId: Id64String;
    overrides?: LegacySetters;
    documentWidth?: number;
    justification?: keyof typeof LegacyJustification;
    paragraphs: Array<{ styleId?: Id64String, overrides?: LegacySetters, runs: LegacyRunFixture[] }>;
  };
  frame?: { styleId: Id64String, overrides?: LegacySetters };
  leaders?: Array<{ styleId: Id64String, overrides?: LegacySetters, attachmentId: number, targetPoint: [number, number, number] }>;
  majorVersion?: number;
}

function toLong(builder: flatbuffers.Builder, value: number | Id64String): flatbuffers.Long {
  if (typeof value === "string")
    return builder.createLong(Id64.getLowerUint32(value), Id64.getUpperUint32(value));

  return builder.createLong(value % 0x100000000, Math.floor(value / 0x100000000));
}

/** Writes a vector of {key:int, integerValue:long, realValue:double} setter structs. */
function createSetters(builder: flatbuffers.Builder, setters: LegacySetters, realKeys: Set<number>): flatbuffers.Offset {
  builder.startVector(24, setters.length, 8);
  for (let i = setters.length - 1; i >= 0; i--) {
    const [key, value] = setters[i];
    const isReal = realKeys.has(key);
    builder.prep(8, 24);
    builder.writeFloat64(isReal ? value as number : 0);
    builder.writeInt64(isReal ? builder.createLong(0, 0) : toLong(builder, value));
    builder.pad(4);
    builder.writeInt32(key);
  }

  return builder.endVector();
}

function createOffsetVector(builder: flatbuffers.Builder, offsets: flatbuffers.Offset[]): flatbuffers.Offset {
  builder.startVector(4, offsets.length, 4);
  for (let i = offsets.length - 1; i >= 0; i--)
    builder.addOffset(offsets[i]);

  return builder.endVector();
}

function newBuilder(): flatbuffers.Builder {
  const builder = new flatbuffers.Builder(1024);
  builder.forceDefaults(true);
  return builder;
}

/** Encodes the `Data` of an AnnotationTextStyle, AnnotationFrameStyle, or AnnotationLeaderStyle. */
function encodeStyle(setters: LegacySetters, realKeys: Set<number>, majorVersion: number): Uint8Array {
  const builder = newBuilder();
  const settersOffset = createSetters(builder, setters, realKeys);
  builder.startObject(3);
  builder.addFieldInt8(0, majorVersion, 0);
  builder.addFieldInt8(1, 0, 0);
  builder.addFieldOffset(2, settersOffset, 0);
  builder.finish(builder.endObject());
  return builder.asUint8Array();
}

export const encodeTextStyle = (setters: LegacySetters) => encodeStyle(setters, textStyleRealKeys, 2);
export const encodeFrameStyle = (setters: LegacySetters) => encodeStyle(setters, frameStyleRealKeys, 2);
export const encodeLeaderStyle = (setters: LegacySetters) => encodeStyle(setters, leaderStyleRealKeys, 1);

const runTypes = { invalid: 0, text: 1, fraction: 2, lineBreak: 3 };
const subSuperScripts = { none: 0, sub: 1, super: 2 };

function createRun(builder: flatbuffers.Builder, run: LegacyRunFixture): flatbuffers.Offset {
  const content = undefined !== run.content ? builder.createString(run.content) : undefined;
  const numerator = undefined !== run.numerator ? builder.createString(run.numerator) : undefined;
  const denominator = undefined !== run.denominator ? builder.createString(run.denominator) : undefined;
  const overrides = createSetters(builder, run.overrides ?? [], textStyleRealKeys);

  builder.startObject(8);
  builder.addFieldInt32(0, runTypes[run.type], 0);
  builder.addFieldInt64(2, toLong(builder, run.styleId), builder.createLong(0, 0));
  builder.addFieldOffset(3, overrides, 0);
  if (content)
    builder.addFieldOffset(4, content, 0);
  if (numerator)
    builder.addFieldOffset(5, numerator, 0);
  if (denominator)
    builder.addFieldOffset(6, denominator, 0);
  if ("text" === run.type)
    builder.addFieldInt32(7, subSuperScripts[run.subSuperScript ?? "none"], 0);

  return builder.endObject();
}

/** Encodes the `TextAnnotation` property of a BisCore:TextAnnotationData aspect. */
export function encodeTextAnnotation(fixture: LegacyTextAnnotationFixture): Uint8Array {
  const builder = newBuilder();
  const zero = builder.createLong(0, 0);

  let document: flatbuffers.Offset | undefined;
  if (fixture.document) {
    const doc = fixture.document;
    const paragraphs = doc.paragraphs.map((paragraph) => {
      const runs = createOffsetVector(builder, paragraph.runs.map((run) => createRun(builder, run)));
      const paragraphOverrides = createSetters(builder, paragraph.overrides ?? [], textStyleRealKeys);
      builder.startObject(4);
      builder.addFieldInt64(1, toLong(builder, paragraph.styleId ?? doc.styleId), zero);
      builder.addFieldOffset(2, paragraphOverrides, 0);
      builder.addFieldOffset(3, runs, 0);
      return builder.endObject();
    });

    const paragraphsOffset = createOffsetVector(builder, paragraphs);
    const properties: LegacySetters = [[TextBlockKey.documentWidth, doc.documentWidth ?? 0], [TextBlockKey.justification, LegacyJustification[doc.justification ?? "left"]]];
    const propertiesOffset = createSetters(builder, properties, new Set([TextBlockKey.documentWidth]));
    const overrides = createSetters(builder, doc.overrides ?? [], textStyleRealKeys);
    builder.startObject(6);
    builder.addFieldInt8(0, 1, 0);
    builder.addFieldInt8(1, 0, 0);
    builder.addFieldOffset(2, propertiesOffset, 0);
    builder.addFieldInt64(3, toLong(builder, doc.styleId), zero);
    builder.addFieldOffset(4, overrides, 0);
    builder.addFieldOffset(5, paragraphsOffset, 0);
    document = builder.endObject();
  }

  let frame: flatbuffers.Offset | undefined;
  if (fixture.frame) {
    const overrides = createSetters(builder, fixture.frame.overrides ?? [], frameStyleRealKeys);
    builder.startObject(4);
    builder.addFieldInt8(0, 1, 0);
    builder.addFieldInt8(1, 0, 0);
    builder.addFieldInt64(2, toLong(builder, fixture.frame.styleId), zero);
    builder.addFieldOffset(3, overrides, 0);
    frame = builder.endObject();
  }

  const leaders = (fixture.leaders ?? []).map((leader) => {
    const overrides = createSetters(builder, leader.overrides ?? [], leaderStyleRealKeys);
    builder.startObject(8);
    builder.addFieldInt8(0, 1, 0);
    builder.addFieldInt8(1, 0, 0);
    builder.addFieldInt64(2, toLong(builder, leader.styleId), zero);
    builder.addFieldOffset(3, overrides, 0);
    builder.addFieldInt32(4, 1, 0); // ById
    builder.addFieldInt32(5, leader.attachmentId, 0);
    builder.addFieldInt32(6, 1, 0); // ByPhysicalPoint
    builder.prep(8, 24);
    builder.writeFloat64(leader.targetPoint[2]);
    builder.writeFloat64(leader.targetPoint[1]);
    builder.writeFloat64(leader.targetPoint[0]);
    builder.addFieldStruct(7, builder.offset(), 0);
    return builder.endObject();
  });
  const leadersOffset = leaders.length > 0 ? createOffsetVector(builder, leaders) : undefined;

  builder.startObject(5);
  builder.addFieldInt8(0, fixture.majorVersion ?? 1, 0);
  builder.addFieldInt8(1, 0, 0);
  if (document)
    builder.addFieldOffset(2, document, 0);
  if (frame)
    builder.addFieldOffset(3, frame, 0);
  if (leadersOffset)
    builder.addFieldOffset(4, leadersOffset, 0);

  builder.finish(builder.endObject());
  return builder.asUint8Array();
}

export type LegacyStyleClass = "AnnotationTextStyle" | "AnnotationFrameStyle" | "AnnotationLeaderStyle";

/** Inserts a legacy style element in the dictionary model with the specified encoded `Data`.
 * The native element handlers do not allow `Data` to be set from JSON, so it is written directly to its column.
 * Close and reopen the iModel before reading the style through native code, so no cached element is used.
 */
export function insertLegacyStyle(txn: EditTxn, className: LegacyStyleClass, name: string, data: Uint8Array): Id64String {
  const iModel = txn.iModel;
  const code = new Code({ spec: iModel.codeSpecs.getByName(`bis:${className}`).id, scope: IModel.dictionaryId, value: name });
  const id = txn.insertElement({ classFullName: `BisCore:${className}`, model: IModel.dictionaryId, code });
  writeBlobProperty(iModel, className, "Data", "ElementId", id, data);
  return id;
}

/** Writes a binary property directly to its column. `idColumn` identifies the row by `id`. */
function writeBlobProperty(iModel: IModelDb, className: string, propertyName: string, idColumn: string, id: Id64String, data: Uint8Array): void {
  const [table, column] = findColumn(iModel, className, propertyName);
  iModel.withSqliteStatement(`UPDATE [${table}] SET [${column}]=? WHERE [${idColumn}]=?`, (stmt) => {
    stmt.bindBlob(1, data);
    stmt.bindId(2, id);
    if (DbResult.BE_SQLITE_DONE !== stmt.step())
      throw new Error(`Failed to write ${className}.${propertyName} of ${id}`);
  });

  const changes = iModel.withSqliteStatement("SELECT changes()", (stmt) => { stmt.step(); return stmt.getValueInteger(0); });
  if (1 !== changes)
    throw new Error(`${className} ${id} not found`);
}

function findColumn(iModel: IModelDb, className: string, propertyName: string): [string, string] {
  const sql = `SELECT t.Name, c.Name FROM ec_PropertyMap pm
    JOIN ec_Column c ON pm.ColumnId=c.Id JOIN ec_Table t ON c.TableId=t.Id
    JOIN ec_PropertyPath pp ON pm.PropertyPathId=pp.Id JOIN ec_Class cl ON pm.ClassId=cl.Id JOIN ec_Schema s ON cl.SchemaId=s.Id
    WHERE s.Name='BisCore' AND cl.Name=? AND pp.AccessString=?`;
  return iModel.withSqliteStatement(sql, (stmt) => {
    stmt.bindString(1, className);
    stmt.bindString(2, propertyName);
    if (DbResult.BE_SQLITE_ROW !== stmt.step())
      throw new Error(`No column for ${className}.${propertyName}`);

    return [stmt.getValueString(0), stmt.getValueString(1)];
  });
}

/** Inserts the BisCore:TextAnnotationData aspect holding `data` for the specified element.
 * The native aspect handler does not allow `TextAnnotation` to be set from JSON, so it is written directly to its column.
 */
export function insertLegacyTextAnnotationData(txn: EditTxn, elementId: Id64String, data: Uint8Array): void {
  txn.insertAspect({
    classFullName: "BisCore:TextAnnotationData",
    element: { id: elementId, relClassName: "BisCore:ElementOwnsUniqueAspect" },
  });
  writeBlobProperty(txn.iModel, "TextAnnotationData", "TextAnnotation", "ElementId", elementId, data);
}
