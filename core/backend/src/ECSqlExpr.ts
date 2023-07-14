import { write } from "fs";

export enum UnaryValueOp {
  Minus = "-",
  Plus = "+",
  BitwiseNot = "~",
}
export enum UnaryBooleanOp {
  Not = "NOT",
}
enum NativeExpIds {
  AllOrAny = "AllOrAnyExp", /**Not supported or working */
  Assignment = "AssignmentExp",
  BetweenRangeValue = "BetweenRangeValueExp",
  PropertyName = "PropertyNameExp",
  BinaryBoolean = "BinaryBooleanExp",
  BinaryValue = "BinaryValueExp",
  BooleanFactor = "BooleanFactorExp",
  Cast = "CastExp",
  ClassName = "ClassNameExp",
  CommonTable = "CommonTableExp",
  CommonTableBlock = "CommonTableBlockExp",
  CommonTableBlockName = "CommonTableBlockNameExp",
  CrossJoin = "CrossJoinExp",
  DeleteStatement = "DeleteStatementExp",
  DerivedProperty = "DerivedPropertyExp",
  UsingRelationshipJoinExp = "UsingRelationshipJoinExp",
  FunctionCall = "FunctionCallExp",
  IIF = "IIFExp",
  InsertStatement = "InsertStatementExp",
  LikeRhsValue = "LikeRhsValueExp",
  LimitOffset = "LimitOffsetExp",
  MemberFunctionCall = "MemberFunctionCallExp",
  NaturalJoin = "NaturalJoinExp",
  OrderBySpec = "OrderBySpecExp",
  Parameter = "ParameterExp",
  QualifiedJoin = "QualifiedJoinExp",
  RowConstructor = "RowConstructor",
  SearchCaseValue = "SearchCaseValueExp",
  SelectStatement = "SelectStatementExp",
  SingleSelectStatement = "SingleSelectStatementExp",
  SubqueryRef = "SubqueryRefExp",
  SubqueryTest = "SubqueryTestExp",
  TableValuedFunction = "TableValuedFunctionExp",
  UnaryValue = "UnaryValueExp",
  UpdateStatement = "UpdateStatementExp",
  Options = "OptionsExp",
  LiteralValue = "LiteralValueExp",
};
export enum BinaryBooleanOP {
  And = "AND",
  Or = "OR",
  EqualTo = "=",
  GreaterThanOrEqualTo = ">=",
  GreaterThan = ">",
  LessThanOrEqualTo = "<=",
  LessThan = "<",
  NotEqualTo = "<>",
  NotEqualTo2 = "!=",
}
export enum BinaryValueOp {
  BitwiseAnd = "&",
  BitwiseOr = "|",
  BitwiseShiftLeft = "<<",
  BitwiseShiftRight = ">>",
  Concat = "||",
  Divide = "/",
  Minus = "-",
  Multiply = "*",
  Plus = "+",
  Modulus = "%",
};
export type DisqualifyOp = "+";
export type RecursiveCte = "RECURSIVE";
export enum OnlyOrAllOp {
  Only = "ONLY",
  All = "ALL",
}
export enum AllOrDistinctOp {
  Distinct = "DISTINCT",
  All = "ALL",
};

export interface NativeECSqlParseNode {
  [key: string]: any;
}

export enum ExpressionType {
  Literal = "Literal",
  Unary = "Unary",
  Parameter = "Parameter",
  Cast = "Cast",
  BinaryValue = "BinaryValue",
  SearchCase = "SearchCase",
  IIF = "IIF",
  FuncCall = "FuncCall",
  PropertyName = "PropertyName",

  Between = "Between",
  // Match = "Match",
  Like = "Like",
  In = "InExp",
  Not = "Not",
  IsOfType = "IsOfType",
  IsNull = "IsNull",
  BinaryBoolean = "BinaryBoolean",
  SubQueryTest = "SubQueryTest",

  UsingRelationshipJoin = "UsingRelationshipJoin",
  QualifiedJoin = "QualifiedJoin",
  SubQueryRef = "SubQueryRef",
  CteBlockRef = "CteBlockRef",
  ClassName = "ClassName",
  TableValuedFunc = "TableValuedFunc",

  DerivedProperty = "DerivedProperty",
  Assignment = "Assignment",
  Select = "SingleSelect",
  ECSqlOptions = "ECSqlOptions",
  CteBlock = "CteBlock",
  MemberFuncCall = "MemberFuncCallExp",

  Cte = "Cte",
  UpdateStatement = "Update",
  InsertStatement = "Insert",
  DeleteStatement = "Delete",
  SelectStatement = "Select",
}

export abstract class Expr {
  public constructor(public readonly expType: ExpressionType) { }
  public abstract writeTo(writer: ECSqlWriter): void;
  public isStatementExpr() { return this instanceof StatementExpr; }
  public isClassRefExpr() { return this instanceof ClassNameExpr; }
  public isComputedExpr() { return this instanceof ComputedExpr; }
  public asStatementExpr() { return this instanceof StatementExpr ? this as StatementExpr : undefined; }
  public asClassRefExpr() { return this instanceof ClassRefExpr ? this as ClassRefExpr : undefined; }
  public asComputedExpr() { return this instanceof ComputedExpr ? this as ComputedExpr : undefined; }
  public toECSql(args?: ECSqlWriterArgs): string {
    if (args) {
      const writer = new ECSqlWriter(args);
      this.writeTo(writer);
      return writer.toString();
    }
    const writer = new ECSqlWriter();
    this.writeTo(writer);
    return writer.toString();
  }
}
export abstract class StatementExpr extends Expr {
  public isSelectStatementExpr() { return this instanceof SelectStatementExpr; }
  public isInsertStatementExpr() { return this instanceof InsertStatementExpr; }
  public isUpdateStatementExpr() { return this instanceof UpdateStatementExpr; }
  public isDeleteStatementExpr() { return this instanceof DeleteStatementExpr; }
  public isCteExpr() { return this instanceof CteExpr };
  public asCteExpr() { return this instanceof CteExpr ? this as CteExpr : undefined; }
  public asInsertStatementExpr() { return this instanceof InsertStatementExpr ? this as InsertStatementExpr : undefined; }
  public asUpdateStatementExpr() { return this instanceof UpdateStatementExpr ? this as UpdateStatementExpr : undefined; }
  public asDeleteStatementExpr() { return this instanceof DeleteStatementExpr ? this as DeleteStatementExpr : undefined; }
  public asSelectStatementExpr() { return this instanceof SelectStatementExpr ? this as SelectStatementExpr : undefined; }
  public static deserialize(node: NativeECSqlParseNode): StatementExpr | InsertStatementExpr | UpdateStatementExpr | DeleteStatementExpr | CteExpr {
    if (node.id === NativeExpIds.CommonTable)
      return CteExpr.deserialize(node);
    if (node.id === NativeExpIds.InsertStatement)
      return InsertStatementExpr.deserialize(node);
    if (node.id === NativeExpIds.UpdateStatement)
      return UpdateStatementExpr.deserialize(node);
    if (node.id === NativeExpIds.DeleteStatement)
      return DeleteStatementExpr.deserialize(node);
    if (node.id === NativeExpIds.SelectStatement)
      return SelectStatementExpr.deserialize(node);
    throw new Error(`unknow node.id = ${node.id}`);
  }
}
export abstract class ComputedExpr extends Expr {
  public isValueExpr() { return this instanceof ValueExpr; }
  public isBooleanExpr() { return this instanceof BooleanExpr; }
  public asValueExpr() { return this instanceof ValueExpr ? this as ValueExpr : undefined; }
  public asBooleanExpr() { return this instanceof BooleanExpr ? this as BooleanExpr : undefined; }
  public static deserialize(node: NativeECSqlParseNode) {
    if (BooleanExpr.deserializableIds.includes(node.id)) {
      return BooleanExpr.deserialize(node);
    }
    if (ValueExpr.deserializableIds.includes(node.id)) {
      return ValueExpr.deserialize(node);
    }
    throw new Error(`unknow node.id = ${node.id}`);
  }
}

export abstract class BooleanExpr extends ComputedExpr {
  public static readonly deserializableIds = [NativeExpIds.BinaryBoolean, NativeExpIds.BooleanFactor, NativeExpIds.SubqueryTest, NativeExpIds.AllOrAny, NativeExpIds.BooleanFactor];
  // public isMatchExpr() { return this instanceof MatchExpr; }
  public isBetweenExpr() { return this instanceof BetweenExpr; }
  public isLikeExpr() { return this instanceof LikeExpr; }
  public isInExpr() { return this instanceof InExpr; }
  public isIsOfTypeExpr() { return this instanceof IsOfTypeExpr; }
  public isNotExpr() { return this instanceof NotExpr; }
  public isBinaryExpr() { return this instanceof BinaryBooleanExpr; }
  public isSubqueryTest() { return this instanceof SubQueryTestExpr; }
  // public asMatchExpr() { return this instanceof MatchExpr ? this as MatchExpr : undefined; }
  public asBetweenExpr() { return this instanceof BetweenExpr ? this as BetweenExpr : undefined; }
  public asLikeExpr() { return this instanceof LikeExpr ? this as LikeExpr : undefined; }
  public asInExpr() { return this instanceof InExpr ? this as InExpr : undefined; }
  public asIsOfTypeExpr() { return this instanceof IsOfTypeExpr ? this as IsOfTypeExpr : undefined; }
  public asNotExpr() { return this instanceof NotExpr ? this as NotExpr : undefined; }
  public asBinaryExpr() { return this instanceof BinaryBooleanExpr ? this as BinaryBooleanExpr : undefined; }
  public asSubqueryTest() { return this instanceof SubQueryTestExpr ? this as SubQueryTestExpr : undefined; }
  public static override deserialize(node: NativeECSqlParseNode): BooleanExpr | SubQueryTestExpr | BetweenExpr | LikeExpr | InExpr | IsNullExpr | IsOfTypeExpr | NotExpr | BinaryBooleanExpr {
    if (node.id === NativeExpIds.BinaryBoolean) {
      const op = (node.op as string);
      // if (MatchExpr.parseOp(op)[0]) {
      //   return MatchExpr.deserialize(node);
      // }
      if (BetweenExpr.parseOp(op)[0]) {
        return BetweenExpr.deserialize(node);
      }
      if (LikeExpr.parseOp(op)[0]) {
        return LikeExpr.deserialize(node);
      }
      if (InExpr.parseOp(op)[0]) {
        return InExpr.deserialize(node);
      }
      if (IsNullExpr.parseOp(node)[0]) {
        return IsNullExpr.deserialize(node);
      }
      if (IsOfTypeExpr.parseOp(node)[0]) {
        return IsOfTypeExpr.deserialize(node);
      }
      return BinaryBooleanExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.BooleanFactor) {
      return NotExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.SubqueryTest) {
      return SubQueryTestExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.BooleanFactor) {
      return NotExpr.deserialize(node);
    }
    throw new Error(`Unknown type of native value exp ${node.id}`);
  }
}

export abstract class ValueExpr extends ComputedExpr {
  public static readonly deserializableIds = [
    NativeExpIds.LiteralValue,
    NativeExpIds.Parameter,
    NativeExpIds.FunctionCall,
    NativeExpIds.Cast,
    NativeExpIds.BinaryValue,
    NativeExpIds.SearchCaseValue,
    NativeExpIds.IIF,
    NativeExpIds.UnaryValue,
    NativeExpIds.PropertyName,
  ];

  public isLiteralExpr() { return this instanceof LiteralExpr; }
  public isParameterExpr() { return this instanceof ParameterExpr; }
  public isFuncCallExpr() { return this instanceof FuncCallExpr; }
  public isCastExpr() { return this instanceof CastExpr; }
  public isBinaryExpr() { return this instanceof BinaryValueExpr; }
  public isCaseExpr() { return this instanceof SearchCaseExpr; }
  public isIIFExpr() { return this instanceof IIFExpr; }
  public isUnaryExpr() { return this instanceof UnaryValueExpr; }
  public isPropertyNameExpr() { return this instanceof PropertyNameExpr; }

  public asLiteralExpr() { return this instanceof LiteralExpr ? this as LiteralExpr : undefined; }
  public asParameterExpr(): ParameterExpr | undefined { return this instanceof ParameterExpr ? this as ParameterExpr : undefined; }
  public asFuncCallExpr() { return this instanceof FuncCallExpr ? this as FuncCallExpr : undefined; }
  public asCastExpr() { return this instanceof CastExpr ? this as CastExpr : undefined; }
  public asBinaryExpr() { return this instanceof BinaryValueExpr ? this as BinaryValueExpr : undefined; }
  public asCaseExpr() { return this instanceof SearchCaseExpr ? this as SearchCaseExpr : undefined; }
  public asIIFExpr() { return this instanceof IIFExpr ? this as IIFExpr : undefined; }
  public asUnaryExpr() { return this instanceof UnaryValueExpr ? this as UnaryValueExpr : undefined; }
  public asPropertyName() { return this instanceof PropertyNameExpr ? this as PropertyNameExpr : undefined; }

  public static override deserialize(node: NativeECSqlParseNode): ValueExpr | UnaryValueExpr | FuncCallExpr | CastExpr | BinaryValueExpr | SearchCaseExpr | IIFExpr | LiteralExpr | PropertyNameExpr {
    if (node.id === NativeExpIds.UnaryValue) {
      return UnaryValueExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.PropertyName) {
      return PropertyNameExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.Parameter) {
      return ParameterExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.FunctionCall) {
      return FuncCallExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.Cast) {
      return CastExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.BinaryValue) {
      return BinaryValueExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.SearchCaseValue) {
      return SearchCaseExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.IIF) {
      return IIFExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.LiteralValue) {
      return LiteralExpr.deserialize(node);
    }
    throw new Error(`Unknown type of native value exp ${node.id}`);
  }
}

export interface PolymorphicInfo {
  scope: OnlyOrAllOp;
  disqualify?: DisqualifyOp;
}
export abstract class ClassRefExpr extends Expr {
  public static readonly deserializableIds = [
    NativeExpIds.ClassName,
    NativeExpIds.SubqueryRef,
    NativeExpIds.UsingRelationshipJoinExp,
    NativeExpIds.QualifiedJoin,
    NativeExpIds.CommonTableBlockName
  ];
  public isClassNameExpr() { return this instanceof ClassNameExpr; }
  public isSubqueryRefExpr() { return this instanceof SubQueryRefExpr; }
  public isUsingRelationshipJoinExpr() { return this instanceof UsingRelationshipJoinExpr; }
  public isQualifiedJoinExpr() { return this instanceof QualifiedJoinExpr; }
  public isCteBlockRefExpr() { return this instanceof CteBlockRefExpr; }

  public asClassNameExpr() { return this instanceof ClassNameExpr ? this as ClassNameExpr : undefined; }
  public asSubqueryRefExpr() { return this instanceof SubQueryRefExpr ? this as SubQueryRefExpr : undefined; }
  public asUsingRelationshipJoinExpr() { return this instanceof UsingRelationshipJoinExpr ? this as UsingRelationshipJoinExpr : undefined; }
  public asQualifiedJoinExpr() { return this instanceof QualifiedJoinExpr ? this as QualifiedJoinExpr : undefined; }
  public asCteBlockRefExpr() { return this instanceof CteBlockRefExpr ? this as CteBlockRefExpr : undefined; }


  public static deserialize(node: NativeECSqlParseNode): ClassRefExpr | ClassNameExpr | SubQueryRefExpr | UsingRelationshipJoinExpr | QualifiedJoinExpr | CteBlockRefExpr {
    if (node.id === NativeExpIds.ClassName) {
      return ClassNameExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.SubqueryRef) {
      return SubQueryRefExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.UsingRelationshipJoinExp) {
      return UsingRelationshipJoinExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.QualifiedJoin) {
      return QualifiedJoinExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.CommonTableBlockName) {
      return CteBlockRefExpr.deserialize(node);
    }
    throw new Error(`Unknown type of native value exp ${node.id}`);
  }
}

export interface ECSqlWriterArgs {
  readonly multiline: boolean;
  readonly eol: "\r\n" | "\n";
  readonly spaceAfterComma: boolean;
  readonly spaceAroundBinOp: boolean;
  readonly keywordCasing: "lower" | "UPPER"
  readonly indent: {
    readonly size: number;
    readonly char: string;
  }
}
export type Keywords = "ALL"
  | "AND"
  | "AS"
  | "ASC"
  | "BETWEEN"
  | "BY"
  | "CASE"
  | "CAST"
  | "CROSS"
  | "DATE"
  | "DELETE"
  | "DESC"
  | "DISTINCT"
  | "ECSQLOPTIONS"
  | "ELSE"
  | "END"
  | "ESCAPE"
  | "EXCEPT"
  | "EXISTS"
  | "FROM"
  | "FULL"
  | "GROUP"
  | "HAVING"
  | "IIF"
  | "IN"
  | "INNER"
  | "INSERT"
  | "INTERSECT"
  | "INTO"
  | "IS"
  | "JOIN"
  | "LEFT"
  | "LIKE"
  | "LIMIT"
  | "NATURAL"
  | "NOT"
  | "NULL"
  | "OFFSET"
  | "ON"
  | "ONLY"
  | "ORDER"
  | "OR"
  | "OUTER"
  | "RECURSIVE"
  | "RIGHT"
  | "SELECT"
  | "SET"
  | "THEN"
  | "TIME"
  | "TIMESTAMP"
  | "UNION"
  | "UPDATE"
  | "USING"
  | "VALUES"
  | "WHEN"
  | "WHERE"
  | "WITH"
  ;
export class ECSqlWriter {
  private _tokens: string[] = [];
  private _currentIndent = 0;
  private _isNewLine = false;
  public constructor(public readonly options: ECSqlWriterArgs = {
    multiline: false,
    spaceAfterComma: true,
    spaceAroundBinOp: true,
    eol: "\r\n",
    keywordCasing: "UPPER",
    indent: { size: 3, char: " " }
  }) { }
  public indent() {
    this._currentIndent++;
  }
  public unindent() {
    if (this._currentIndent > 0)
      this._currentIndent--;
  }
  public appendBinaryOp(val: string) {
    if (this.options.spaceAroundBinOp)
      return this.append(` ${val} `);
    return this.append(val);
  }
  public appendKeyword(val: Keywords) {
    if (this.options.keywordCasing === "UPPER")
      return this.append(val);
    return this.append(val.toLowerCase());
  }
  public appendComma() {
    this.append(",");
    if (this.options.spaceAfterComma)
      this.appendSpace();
  }
  public append(val: string) {
    if (this._isNewLine) {
      if (this._currentIndent > 0 && this.options.indent.size > 0 && this.options.indent.char.length === 1) {
        this._tokens.push("".padEnd(this._currentIndent * this.options.indent.size, this.options.indent.char));
      }
      this._isNewLine = false;
    }
    this._tokens.push(val);
    return this;
  }
  public appendStringLiteral(val: string) {
    return this.append(`'${val}'`);
  }
  public appendLineOrSpace() {
    if (this.options.multiline)
      return this.appendLine();
    return this.appendSpace();
  }
  public appendSpace() {
    return this.append(" ");
  }
  public appendLine() {
    if (this.options.multiline) {
      this._isNewLine = true;
      if (this._tokens.length > 0) {
        this._tokens[this._tokens.length - 1] = this._tokens[this._tokens.length - 1].trimEnd();
      }
      this._tokens.push(this.options.eol);
    }
    return this;
  }
  public clear() {
    this._tokens = [];
    return this;
  }
  public squash() {
    if (this._tokens.length > 1) {
      this._tokens = [this.toString()];
    }
    return this;
  }
  public toString() {
    return this._tokens.join("");
  }
  public appendExp(exp: Expr) {
    exp.writeTo(this);
    return this;
  }
}
export enum SortDirection {
  Ascending = "ASC",
  Desending = "DESC"
}
export interface OrderBySpec {
  exp: ValueExpr;
  direction?: SortDirection
}
export interface LimitSpec {
  limit: ValueExpr;
  offset?: ValueExpr;
}
export interface GroupBySpec {
  groupBy: ValueExpr[];
  having?: ComputedExpr;
}

export enum CompoundSelectOp {
  Union = "UNION",
  UnionAll = "UNION ALL",
  Intersect = "INTERSECT",
  Except = "EXCEPT"
}
export interface NextSelectStatement {
  op: CompoundSelectOp;
  select: SelectStatementExpr;
}
export enum SubQueryTestOp {
  // Unique = "UNIQUE", //! Not supported
  Exists = "EXISTS"
}
export enum JoinDirection {
  Forward = "FORWARD",
  Backward = "BACKWARD"
}
export type JoinSpec = BooleanExpr | string[] | undefined;
export enum JoinType {
  LeftOuter = "LEFT OUTER JOIN",
  RightOuter = "RIGHT OUTER JOIN",
  FullOuter = "FULL OUTER JOIN",
  Inner = "INNER JOIN",
  Cross = "CROSS JOIN",
  Natural = "NATURAL",
};
export class DerivedPropertyExpr extends Expr {
  public constructor(public readonly exp: ComputedExpr, public readonly alias?: string) {
    super(ExpressionType.DerivedProperty);
  }
  public static deserialize(node: NativeECSqlParseNode): DerivedPropertyExpr {
    if (node.id !== NativeExpIds.DerivedProperty) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.DerivedProperty'. ${JSON.stringify(node)}`);
    }
    return new DerivedPropertyExpr(ComputedExpr.deserialize(node.exp as NativeECSqlParseNode), node.alias ? node.alias as string : undefined);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.exp);
    if (this.alias) {
      writer.appendSpace();
      writer.append(this.alias);
    }
  }
}
export class DeleteStatementExpr extends StatementExpr {
  public constructor(
    public readonly className: ClassNameExpr,
    public readonly where?: ComputedExpr,
    public readonly options?: ECSqlOptionsExpr) {
    super(ExpressionType.DeleteStatement);
  }
  public static override deserialize(node: NativeECSqlParseNode): DeleteStatementExpr {
    if (node.id !== NativeExpIds.DeleteStatement) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.DeleteStatement'. ${JSON.stringify(node)}`);
    }

    const className = ClassNameExpr.deserialize(node.class as NativeECSqlParseNode);
    const where = node.where ? ComputedExpr.deserialize(node.where as NativeECSqlParseNode) : undefined;
    const options = node.options ? ECSqlOptionsExpr.deserialize(node.options as NativeECSqlParseNode) : undefined;
    return new DeleteStatementExpr(className, where, options);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("DELETE");
    writer.appendSpace();
    writer.appendKeyword("FROM");
    writer.appendSpace();
    writer.appendExp(this.className);
    if (this.where) {
      writer.appendSpace();
      writer.appendKeyword("WHERE");
      writer.appendSpace();
      writer.appendExp(this.where);
    }
    if (this.options) {
      writer.appendSpace();
      writer.appendExp(this.options);
    }
  }
}
export class InsertStatementExpr extends StatementExpr {
  public constructor(
    public readonly className: ClassNameExpr,
    public readonly values: ValueExpr[],
    public readonly propertyNames?: string[]) {
    super(ExpressionType.InsertStatement);
  }
  public static override deserialize(node: NativeECSqlParseNode): InsertStatementExpr {
    if (node.id !== NativeExpIds.InsertStatement) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.InsertStatement'. ${JSON.stringify(node)}`);
    }

    const className = ClassNameExpr.deserialize(node.class as NativeECSqlParseNode);
    const values = Array.from((node.values as NativeECSqlParseNode[]).map((v) => ValueExpr.deserialize(v)));
    let properties: string[] | undefined;
    if (node.properties) {
      properties = node.properties as string[];
    }
    return new InsertStatementExpr(className, values, properties);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("INSERT");
    writer.appendSpace();
    writer.appendExp(this.className);
    writer.appendSpace();
    if (this.propertyNames) {
      writer.append("(");
      this.propertyNames.forEach((v, i) => {
        if (i > 0) {
          writer.appendComma();
        }
        writer.append(v);
      });
      writer.append(")");
    }
    writer.appendSpace();
    writer.appendKeyword("VALUES");
    writer.append("(");
    this.values.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
    writer.append(")");
  }
}
export class QualifiedJoinExpr extends ClassRefExpr {
  public constructor(
    public readonly joinType: JoinType,
    public readonly from: ClassRefExpr,
    public readonly to: ClassRefExpr,
    public readonly spec: JoinSpec) {
    super(ExpressionType.QualifiedJoin);
  }
  public static override deserialize(node: NativeECSqlParseNode): QualifiedJoinExpr {
    if (node.id !== NativeExpIds.QualifiedJoin) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.QualifiedJoin'. ${JSON.stringify(node)}`);
    }
    const type = node.type as JoinType;
    const from = ClassRefExpr.deserialize(node.from as NativeECSqlParseNode);
    const to = ClassRefExpr.deserialize(node.to as NativeECSqlParseNode);
    let spec: JoinSpec | undefined;
    if (Array.isArray(node.spec))
      spec = node.spec as string[];
    else
      spec = BooleanExpr.deserialize(node.spec as NativeECSqlParseNode);
    return new QualifiedJoinExpr(type, from, to, spec);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.from);
    writer.appendSpace();
    if (this.joinType === JoinType.Cross) {
      writer.appendKeyword("CROSS").appendSpace();
    } else if (this.joinType == JoinType.LeftOuter) {
      writer.appendKeyword("LEFT").appendSpace();
      writer.appendKeyword("OUTER").appendSpace();
      writer.appendKeyword("JOIN").appendSpace();
    } else if (this.joinType == JoinType.RightOuter) {
      writer.appendKeyword("RIGHT").appendSpace();
      writer.appendKeyword("OUTER").appendSpace();
      writer.appendKeyword("JOIN").appendSpace();
    } else if (this.joinType === JoinType.FullOuter) {
      writer.appendKeyword("FULL").appendSpace();
      writer.appendKeyword("OUTER").appendSpace();
      writer.appendKeyword("JOIN").appendSpace();
    } else if (this.joinType === JoinType.Inner) {
      writer.appendKeyword("INNER").appendSpace();
      writer.appendKeyword("JOIN").appendSpace();
    } else if (this.joinType === JoinType.Natural) {
      writer.appendKeyword("NATURAL").appendSpace();
    } else {
      throw new Error(`not supported join type ${this.joinType}`)
    }
    writer.appendExp(this.to);
    if (this.spec) {
      writer.appendSpace();
      if (this.spec instanceof BooleanExpr) {
        writer.appendKeyword("ON");
        writer.appendSpace();
        writer.appendExp(this.spec);
      } else if (this.spec instanceof Array) {
        writer.appendKeyword("USING");
        this.spec.forEach((v, i) => {
          if (i > 0) {
            writer.appendComma();
            writer.append(v);
          }
        });
      } else {
        throw new Error("unknow join spec");
      }
    }
  }
}
export class UsingRelationshipJoinExpr extends ClassRefExpr {
  public constructor(
    public readonly fromClassName: ClassNameExpr,
    public readonly toRelClassName: ClassNameExpr,
    public readonly direction?: JoinDirection) {
    super(ExpressionType.UsingRelationshipJoin);
  }
  public static override deserialize(node: NativeECSqlParseNode): UsingRelationshipJoinExpr {
    if (node.id !== NativeExpIds.UsingRelationshipJoinExp) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.UsingRelationshipJoinExp'. ${JSON.stringify(node)}`);
    }
    const from = ClassNameExpr.deserialize(node.from as NativeECSqlParseNode);
    const to = ClassNameExpr.deserialize(node.from as NativeECSqlParseNode);
    const direction = node.direction ? node.direction as JoinDirection : undefined;
    return new UsingRelationshipJoinExpr(from, to, direction);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("JOIN");
    writer.appendSpace();
    writer.appendExp(this.fromClassName);
    writer.appendSpace();
    writer.appendKeyword("USING");
    writer.appendSpace();
    writer.appendExp(this.toRelClassName);
  }
}
export class SubQueryTestExpr extends BooleanExpr {
  public constructor(public readonly op: SubQueryTestOp, public readonly query: SelectStatementExpr) {
    super(ExpressionType.SubQueryTest);
  }
  public static override deserialize(node: NativeECSqlParseNode): SubQueryTestExpr {
    if (node.id !== NativeExpIds.SubqueryTest) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.SubqueryTest'. ${JSON.stringify(node)}`);
    }
    const query = SelectStatementExpr.deserialize(node.query as NativeECSqlParseNode);
    const op = node.op as SubQueryTestOp
    return new SubQueryTestExpr(op, query);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword(this.op);
    writer.append("(");
    writer.appendExp(this.query);
    writer.append(")");
  }
}

export class SubQueryRefExpr extends ClassRefExpr {
  public constructor(public readonly query: SelectStatementExpr, public readonly polymorphicInfo?: PolymorphicInfo, public readonly alias?: string) {
    super(ExpressionType.SubQueryRef);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.SubqueryRef) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.SubqueryRef'. ${JSON.stringify(node)}`);
    }
    const query = SelectStatementExpr.deserialize(node.query as NativeECSqlParseNode);
    const polymorphicInfo = node.polymorphicInfo ? node.polymorphicInfo as PolymorphicInfo : undefined;
    const alias = node.alias ? node.alias as string : undefined;
    return new SubQueryRefExpr(query, polymorphicInfo, alias);
  }
  public override writeTo(writer: ECSqlWriter): void {
    if (this.polymorphicInfo) {
      if (this.polymorphicInfo.disqualify) {
        writer.append(this.polymorphicInfo.disqualify);
      }
      writer.appendKeyword(this.polymorphicInfo.scope)
      writer.appendSpace();
    }
    writer.append("(");
    writer.appendExp(this.query);
    writer.append(")");
    if (this.alias) {
      writer.appendSpace();
      writer.append(this.alias);
    }
  }
}
export class SelectStatementExpr extends StatementExpr {
  public constructor(public readonly singleSelect: SelectExpr, public readonly nextStmt?: NextSelectStatement) {
    super(ExpressionType.SelectStatement);
  }
  public static override deserialize(node: NativeECSqlParseNode): SelectStatementExpr {
    if (node.id !== NativeExpIds.SelectStatement) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.SelectStatement'. ${JSON.stringify(node)}`);
    }
    const singleSelect = SelectExpr.deserialize(node.select as NativeECSqlParseNode);
    let next: NextSelectStatement | undefined;
    if (node.next) {
      next = {
        op: node.combineOp as CompoundSelectOp,
        select: SelectStatementExpr.deserialize(node.next as NativeECSqlParseNode),
      };
    }
    return new SelectStatementExpr(singleSelect, next);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.singleSelect);
    if (this.nextStmt) {
      writer.appendSpace();
      if (this.nextStmt.op === CompoundSelectOp.UnionAll) {
        writer.appendKeyword("UNION");
        writer.appendSpace();
        writer.appendKeyword("ALL");
      } else {
        writer.append(this.nextStmt.op);
      }
      writer.appendSpace();
      writer.appendExp(this.nextStmt.select);
    }
  }
}

export class SelectExpr extends Expr {
  public constructor(
    public readonly selection: DerivedPropertyExpr[],
    public readonly rowQuantifier?: AllOrDistinctOp,
    public readonly from?: ClassRefExpr[],
    public readonly where?: ComputedExpr,
    public readonly groupBySpec?: GroupBySpec,
    public readonly orderBy?: OrderBySpec[],
    public readonly limit?: LimitSpec,
    public readonly options?: ECSqlOptionsExpr) {
    super(ExpressionType.Select);
  }
  private static deserializeLimit(limit?: NativeECSqlParseNode): LimitSpec | undefined {
    if (!limit) return undefined;
    return {
      limit: ValueExpr.deserialize(limit.exp as NativeECSqlParseNode),
      offset: limit.offset ? ValueExpr.deserialize(limit.offset as NativeECSqlParseNode) : undefined
    };
  }
  private static deserializeSelection(selection: NativeECSqlParseNode[]) {
    return Array.from(selection.map((v) => DerivedPropertyExpr.deserialize(v)));
  }
  private static deserializOptions(options?: NativeECSqlParseNode) {
    if (!options)
      return undefined;
    return ECSqlOptionsExpr.deserialize(options);
  }
  private static deserializeWhere(where?: NativeECSqlParseNode) {
    if (!where)
      return undefined;
    return ComputedExpr.deserialize(where);
  }
  private static deserializeHaving(having?: NativeECSqlParseNode) {
    if (!having)
      return undefined;
    return ComputedExpr.deserialize(having);
  }
  private static deserializeGroupBy(groupBy?: NativeECSqlParseNode[], having?: NativeECSqlParseNode): GroupBySpec | undefined {
    if (!groupBy)
      return undefined;
    return {
      groupBy: Array.from(groupBy.map((v) => ValueExpr.deserialize(v))),
      having: having ? this.deserializeHaving(having) : undefined
    };
  }
  private static deserializeRowConstructor(values: NativeECSqlParseNode[]) {
    return Array.from(values.map((v) => DerivedPropertyExpr.deserialize(v)));
  }
  private static deserializeFrom(classRefs?: NativeECSqlParseNode[]) {
    if (!classRefs)
      return undefined;
    return Array.from(classRefs.map((v) => ClassRefExpr.deserialize(v)));
  }
  private static deserializeOrderBy(sortBy?: NativeECSqlParseNode[]) {
    if (!sortBy)
      return undefined;
    return Array.from(sortBy.map((v) => {
      return {
        exp: ValueExpr.deserialize(v.exp as NativeECSqlParseNode),
        direction: v.direction ? v.direction as SortDirection : undefined,
      }
    }));
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.SingleSelectStatement && node.id !== NativeExpIds.RowConstructor) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.SingleSelectStatement/RowConstructor'. ${JSON.stringify(node)}`);
    }
    if (node.id === NativeExpIds.RowConstructor) {
      const selection = this.deserializeRowConstructor(node.values as NativeECSqlParseNode[]);
      return new SelectExpr(selection);
    }
    const selection = this.deserializeSelection(node.selection as NativeECSqlParseNode[]);
    const from = this.deserializeFrom(node.from as NativeECSqlParseNode[]);
    const where = this.deserializeWhere(node.where as NativeECSqlParseNode);
    const groupBy = this.deserializeGroupBy(node.groupBy as NativeECSqlParseNode[], node.having as NativeECSqlParseNode);
    const orderBy = this.deserializeOrderBy(node.orderBy as NativeECSqlParseNode[]);
    const options = this.deserializOptions(node.options as NativeECSqlParseNode);
    const limitSpec = this.deserializeLimit(node.limit as NativeECSqlParseNode);
    const rowQuantifier = node.selectionType ? node.selectionType as AllOrDistinctOp : undefined;
    return new SelectExpr(selection, rowQuantifier, from, where, groupBy, orderBy, limitSpec, options);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("SELECT");
    writer.appendSpace();
    if (this.rowQuantifier) {
      writer.appendKeyword(this.rowQuantifier);
      writer.appendSpace();
    }
    this.selection.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });

    if (this.from) {
      writer.appendSpace();
      writer.appendKeyword("FROM");
      writer.appendSpace();
      this.from.forEach((v, i) => {
        if (i > 0) {
          writer.appendComma();
        }
        writer.appendLine();
        writer.appendExp(v);
      });
    }

    if (this.where) {
      writer.appendSpace();
      writer.appendKeyword("WHERE");
      writer.appendSpace();
      writer.appendExp(this.where);
    }
    if (this.groupBySpec) {
      writer.appendSpace();
      writer.appendKeyword("GROUP");
      writer.appendSpace();
      writer.appendKeyword("BY");
      writer.appendSpace();
      this.groupBySpec.groupBy.forEach((v, i) => {
        if (i > 0) {
          writer.appendComma();
        }
        writer.appendExp(v);
      });
      const having = this.groupBySpec.having;
      if (having) {
        writer.appendSpace();
        writer.appendKeyword("HAVING");
        writer.appendSpace();
        writer.appendExp(having);
      }
    }
    if (this.orderBy) {
      writer.appendSpace();
      writer.appendKeyword("ORDER");
      writer.appendSpace();
      writer.appendKeyword("BY");
      writer.appendSpace();
      this.orderBy.forEach((v, i) => {
        if (i > 0) {
          writer.appendComma();
        }
        writer.appendExp(v.exp);
        if (v.direction) {
          writer.appendSpace();
          writer.appendKeyword(v.direction);
        }
      });
    }
    if (this.limit) {
      writer.appendSpace();
      writer.appendKeyword("LIMIT");
      writer.appendSpace();
      writer.appendExp(this.limit.limit);
      if (this.limit.offset) {
        writer.appendSpace();
        writer.appendKeyword("OFFSET");
        writer.appendSpace();
        writer.appendExp(this.limit.offset);
      }
    }
    if (this.options) {
      writer.appendSpace();
      writer.appendExp(this.options);
    }
  }
}

export class BinaryBooleanExpr extends BooleanExpr {
  public constructor(public readonly op: BinaryBooleanOP, public readonly lhs: ComputedExpr, public readonly rhs: ComputedExpr, public readonly not?: UnaryBooleanOp) {
    super(ExpressionType.BinaryBoolean);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryBoolean'. ${JSON.stringify(node)}`);
    }
    const op = node.op as BinaryBooleanOP;
    return new BinaryBooleanExpr(op, ComputedExpr.deserialize(node.lhs as NativeECSqlParseNode), ComputedExpr.deserialize(node.rhs as NativeECSqlParseNode));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append("(");
    writer.appendExp(this.lhs);;
    writer.appendBinaryOp(this.op);
    writer.appendExp(this.rhs);;
    writer.append(")");
  }
}
export enum LiteralValueType {
  Null = "NULL",
  String = "STRING",
  Date = "DATE",
  Time = "TIME",
  Timestamp = "TIMESTAMP",
  Raw = "RAW"
}

export class IsNullExpr extends BooleanExpr {
  public constructor(public readonly exp: ValueExpr, public readonly not?: UnaryBooleanOp) {
    super(ExpressionType.IsNull);
  }
  public static parseOp(node: NativeECSqlParseNode) {
    const op = node.op as string;
    const isLiteral = node.rhs.op === NativeExpIds.LiteralValue;
    if (!isLiteral) {
      return [false, false];
    }
    const isNull = LiteralExpr.deserialize(node.rhs as NativeECSqlParseNode).rawValue === "NULL";
    return [op.startsWith("IS"), isNull];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryBoolean'. ${JSON.stringify(node)}`);
    }
    const [isNullExp, isNull] = this.parseOp(node);
    if (!isNullExp) {
      throw new Error(`Parse node has 'node.op !== IS NULL'. ${JSON.stringify(node)}`);
    }
    const exp = ValueExpr.deserialize(node.lhs as NativeECSqlParseNode);
    return new IsNullExpr(exp, isNull ? UnaryBooleanOp.Not : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.exp);
    writer.appendSpace();
    writer.appendKeyword("IS");
    writer.appendSpace();
    if (this.not) {
      writer.appendKeyword("NOT");
      writer.appendSpace();
    }
    writer.appendKeyword("NULL");
  }
}
export class IsOfTypeExpr extends BooleanExpr {
  public constructor(public readonly exp: ValueExpr, public readonly typeNames: ClassNameExpr[], public readonly not?: UnaryBooleanOp) {
    super(ExpressionType.IsOfType);
  }
  public static parseOp(node: NativeECSqlParseNode) {
    const op = node.op as string;
    return [op.startsWith("IS") && Array.isArray(node.rhs), op.endsWith("NOT")];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryBoolean'. ${JSON.stringify(node)}`);
    }
    const [isTypeOf, isNull] = this.parseOp(node);
    if (!isTypeOf) {
      throw new Error(`Parse node has 'node.op !== IS (type....)'. ${JSON.stringify(node)}`);
    }
    const exp = ValueExpr.deserialize(node.lhs as NativeECSqlParseNode);
    const classNames = Array.from((node.rhs as NativeECSqlParseNode[]).map((v) => ClassNameExpr.deserialize(v)));
    return new IsOfTypeExpr(exp, classNames, isNull ? UnaryBooleanOp.Not : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.exp);
    writer.appendSpace();
    writer.appendKeyword("IS");
    writer.appendSpace();
    if (this.not) {
      writer.appendKeyword("NOT");
      writer.appendSpace();
    }
    writer.append("(");
    this.typeNames.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
    writer.append(")");
  }
}

export class NotExpr extends BooleanExpr {
  public constructor(public readonly exp: ComputedExpr) {
    super(ExpressionType.Not);
  }

  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BooleanFactor) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BooleanFactor'. ${JSON.stringify(node)}`);
    }
    const exp = ComputedExpr.deserialize(node.exp as NativeECSqlParseNode);
    return new NotExpr(exp);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append("(");
    writer.appendKeyword("NOT");
    writer.appendSpace();
    writer.appendExp(this.exp);
    writer.append(")");
  }
}
export class InExpr extends BooleanExpr {
  public constructor(public readonly lhs: ValueExpr, public readonly rhs: ValueExpr[] | SelectStatementExpr, public readonly not?: UnaryBooleanOp) {
    super(ExpressionType.In);
  }
  public static parseOp(op: string) {
    return [op.endsWith("IN"), op.startsWith("NOT ")];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryBoolean'. ${JSON.stringify(node)}`);
    }
    const [isIn, isNull] = this.parseOp(node.op as string);
    if (!isIn) {
      throw new Error(`Parse node has 'node.op !== IN'. ${JSON.stringify(node)}`);
    }
    const lhs = ValueExpr.deserialize(node.lhs as NativeECSqlParseNode);
    if (Array.isArray(node.rhs))
      return new InExpr(lhs, Array.from((node.rhs as NativeECSqlParseNode[]).map((v) => ValueExpr.deserialize(v))), isNull ? UnaryBooleanOp.Not : undefined);
    else if (node.rhs.id === NativeExpIds.SelectStatement)
      return new InExpr(lhs, SelectStatementExpr.deserialize(node.rhs as NativeECSqlParseNode), isNull ? UnaryBooleanOp.Not : undefined);
    else
      throw new Error(`unknown IN rhs ${node.rhs.id}`);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.lhs);;
    writer.appendSpace();
    if (this.not) {
      writer.appendKeyword("NOT");
      writer.appendSpace();
    }
    writer.appendKeyword("IN");
    writer.appendSpace();
    writer.append("(");
    if (this.rhs instanceof SelectStatementExpr) {
      writer.appendExp(this.rhs);
    } else if (Array.isArray(this.rhs)) {
      this.rhs.forEach((v, i) => {
        if (i > 0) {
          writer.appendComma();
        }
        writer.appendExp(v);
      });
    } else {
      throw new Error("unknown expression on rhs of IN expr.")
    }
    writer.append(")");
  }
}
export class LikeExpr extends BooleanExpr {
  public constructor(public readonly lhs: ValueExpr, public readonly pattern: ValueExpr, public readonly escape?: ValueExpr, public readonly not?: UnaryBooleanOp) {
    super(ExpressionType.Like);
  }
  public static parseOp(op: string) {
    return [op.endsWith("LIKE"), op.startsWith("NOT ")];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryBoolean'. ${JSON.stringify(node)}`);
    }
    const [isLike, isNull] = this.parseOp(node.op as string);
    if (!isLike) {
      throw new Error(`Parse node has 'node.op !== LIKE'. ${JSON.stringify(node)}`);
    }
    const lhs = ValueExpr.deserialize(node.lhs as NativeECSqlParseNode);
    const pattren = ValueExpr.deserialize(node.rhs.pattren as NativeECSqlParseNode);
    const escape = node.rhs.escape ? ValueExpr.deserialize(node.rhs.escape as NativeECSqlParseNode) : undefined;
    return new LikeExpr(lhs, pattren, escape, isNull ? UnaryBooleanOp.Not : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.lhs);;
    writer.appendSpace();
    if (this.not) {
      writer.appendKeyword("NOT");
      writer.appendSpace();
    }
    writer.appendKeyword("LIKE");
    writer.appendSpace();
    writer.appendExp(this.pattern);
    if (this.escape) {
      writer.appendSpace();
      writer.appendKeyword("ESCAPE");
      writer.appendSpace();
      writer.appendExp(this.escape);
    }
  }
}
// export class MatchExpr extends BooleanExpr {
//   public constructor(public readonly lhs: ValueExpr, public readonly rhs: ValueExpr, public readonly not?: UnaryBooleanOp) {
//     super(ExpressionType.Match);
//   }
//   public static parseOp(op: string) {
//     return [op.endsWith(" MATCH"), op.startsWith("NOT ")];
//   }
//   public static override deserialize(node: NativeECSqlParseNode) {
//     if (node.id !== NativeExpIds.BinaryBoolean) {
//       throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryBoolean'. ${JSON.stringify(node)}`);
//     }
//     const [isMatch, isNull] = this.parseOp(node.op as string);
//     if (!isMatch) {
//       throw new Error(`Parse node has 'node.op !== MATCH'. ${JSON.stringify(node)}`);
//     }
//     return new MatchExpr(ValueExpr.deserialize(node.lhs as NativeECSqlParseNode), ValueExpr.deserialize(node.rhs as NativeECSqlParseNode), isNull ? UnaryBooleanOp.Not : undefined);
//   }
// }
export interface BetweenBounds {
  lower: ValueExpr;
  upper: ValueExpr;
}
export class BetweenExpr extends BooleanExpr {
  public constructor(public readonly lhs: ValueExpr, public readonly bounds: BetweenBounds, public readonly not?: UnaryBooleanOp) {
    super(ExpressionType.Between);
  }
  public static parseOp(op: string) {
    return [op.endsWith(" BETWEEN"), op.startsWith("NOT ")];
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryBoolean'. ${JSON.stringify(node)}`);
    }
    const [isBetween, isNull] = this.parseOp(node.op as string);
    if (!isBetween) {
      throw new Error(`Parse node has 'node.op !== BETWEEN'. ${JSON.stringify(node)}`);
    }
    const rhs = node.rhs as NativeECSqlParseNode;
    const bounds: BetweenBounds = {
      lower: ValueExpr.deserialize(rhs.lbound as NativeECSqlParseNode),
      upper: ValueExpr.deserialize(rhs.ubound as NativeECSqlParseNode)
    };
    return new BetweenExpr(ValueExpr.deserialize(node.lhs as NativeECSqlParseNode), bounds, isNull ? UnaryBooleanOp.Not : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.lhs);;
    writer.appendSpace();
    if (this.not) {
      writer.appendKeyword("NOT");
      writer.appendSpace();
    }
    writer.appendKeyword("BETWEEN");
    writer.appendSpace();
    writer.appendExp(this.bounds.lower);
    writer.appendSpace();
    writer.appendKeyword("AND");
    writer.appendSpace();
    writer.appendExp(this.bounds.upper);
  }
}
export class CteExpr extends StatementExpr {
  public constructor(public readonly cteBlocks: CteBlockExpr[], public readonly query: SelectStatementExpr, public readonly recursive?: RecursiveCte) {
    super(ExpressionType.Cte);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.CommonTable) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.CommonTable'. ${JSON.stringify(node)}`);
    }
    const blocks = Array.from((node.blocks as NativeECSqlParseNode[]).map((v) => CteBlockExpr.deserialize(v)));
    return new CteExpr(blocks, SelectStatementExpr.deserialize(node.select as NativeECSqlParseNode), node.recursive === true ? "RECURSIVE" : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("WITH");
    writer.appendSpace();
    if (this.recursive) {
      writer.appendKeyword(this.recursive);
      writer.appendSpace();
    }
    this.cteBlocks.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
    writer.appendSpace();
    writer.appendExp(this.query);
  }
}
export class CteBlockExpr extends Expr {
  public constructor(public readonly name: string, public readonly query: SelectStatementExpr, public readonly props: string[]) {
    super(ExpressionType.CteBlock);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.CommonTableBlock) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.CommonTableBlock'. ${JSON.stringify(node)}`);
    }
    return new CteBlockExpr(node.name as string, SelectStatementExpr.deserialize(node.asQuery as NativeECSqlParseNode), node.args as string[]);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append(this.name);
    writer.append("(");
    this.props.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.append(v);
    });
    writer.append(")");
    writer.appendSpace();
    writer.appendKeyword("AS");
    writer.appendSpace();
    writer.append("(");
    writer.appendLine();
    writer.indent();
    writer.appendExp(this.query);
    writer.unindent();
    writer.appendLine();
    writer.append(")");
  }
}
export class CteBlockRefExpr extends ClassRefExpr {
  public constructor(public readonly name: string, public readonly alias?: string) {
    super(ExpressionType.CteBlockRef);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.CommonTableBlockName) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.CommonTableBlockName'. ${JSON.stringify(node)}`);
    }
    return new CteBlockRefExpr(node.name as string, node.alias ? node.alias as string : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append(this.name);
    if (this.alias) {
      writer.append(this.alias);
    };
  }
}

export class TableValuedFuncExpr extends ClassRefExpr {
  public constructor(public readonly schemaName: string, public readonly memberFunc: MemberFuncCallExpr) {
    super(ExpressionType.TableValuedFunc);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.TableValuedFunction) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.TableValuedFunction'. ${JSON.stringify(node)}`);
    }
    return new TableValuedFuncExpr(node.schema as string, MemberFuncCallExpr.deserialize(node.func as NativeECSqlParseNode));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append(this.schemaName);
    writer.append(".");
    writer.appendExp(this.memberFunc);
  }
}
export class ClassNameExpr extends ClassRefExpr {
  public constructor(public readonly schemaNameOrAlias: string, public readonly className: string, public readonly tablespace?: string, public readonly alias?: string, public readonly polymorphicInfo?: PolymorphicInfo, public readonly memberFunc?: MemberFuncCallExpr) {
    super(ExpressionType.ClassName);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.ClassName) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.ClassName'. ${JSON.stringify(node)}`);
    }
    const className = node.className as string;
    const tablespace = node.tableSpace ? node.tableSpace as string : undefined;
    const schemaName = node.schemaName as string;

    const alias = node.alias ? node.alias as string : undefined;
    const polymorphicInfo = node.polymorphicInfo ? node.polymorphicInfo as PolymorphicInfo : undefined;
    const memberFunc = node.func ? MemberFuncCallExpr.deserialize(node.func as NativeECSqlParseNode) : undefined;
    return new ClassNameExpr(schemaName, className, tablespace, alias, polymorphicInfo, memberFunc);
  }
  public writeTo(writer: ECSqlWriter): void {
    if (this.polymorphicInfo) {
      if (this.polymorphicInfo.disqualify) {
        writer.append(this.polymorphicInfo.disqualify);
      }
      writer.appendKeyword(this.polymorphicInfo.scope);
      writer.appendSpace();
    }
    if (this.tablespace) {
      writer.append("[").append(this.tablespace).append("]");
      writer.append(".");
    }
    writer.append("[").append(this.schemaNameOrAlias).append("]");
    writer.append(".");
    writer.append("[").append(this.className).append("]");

    if (this.memberFunc) {
      writer.append(".");
      writer.appendExp(this.memberFunc);
    }
    if (this.alias) {
      writer.appendSpace();
      writer.append(this.alias);
    }
  }
}

export class UpdateStatementExpr extends StatementExpr {
  public constructor(public readonly className: string, public readonly assignement: AssignmentExpr, public readonly where?: BooleanExpr, public readonly options?: ECSqlOptionsExpr) {
    super(ExpressionType.UpdateStatement);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.UpdateStatement) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.UpdateStatement'. ${JSON.stringify(node)}`);
    }
    const className = node.className as string;
    const assignment = AssignmentExpr.deserialize(node.assignment as NativeECSqlParseNode);
    const where = node.where ? BooleanExpr.deserialize(node.where as NativeECSqlParseNode) : undefined;
    const options = node.options ? ECSqlOptionsExpr.deserialize(node.options as NativeECSqlParseNode) : undefined;
    return new UpdateStatementExpr(className, assignment, where, options);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("UPDATE");
    writer.appendSpace();
    writer.append(this.className);
    writer.appendSpace();
    writer.appendKeyword("SET");
    writer.appendSpace();
    writer.appendExp(this.assignement);
    if (this.where) {
      writer.appendSpace();
      writer.appendKeyword("WHERE");
      writer.appendSpace();
      writer.appendExp(this.where);
    }
    if (this.options) {
      writer.appendSpace();
      writer.appendExp(this.options);
    }
  }
}
export type ECSqlSupportedOptions = "NoECClassIdFilter" | "ReadonlyPropertiesAreUpdatable";
export interface ECSqlOption {
  name: ECSqlSupportedOptions;
  value?: string;
}
export class ECSqlOptionsExpr extends Expr {
  public constructor(public readonly options: ECSqlOption[]) {
    super(ExpressionType.ECSqlOptions);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.Options) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.Options'. ${JSON.stringify(node)}`);
    }
    return new ECSqlOptionsExpr(node.options as ECSqlOption[]);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("ECSQLOPTIONS");
    writer.appendSpace();
    this.options.forEach((v, i) => {
      if (i > 0) {
        writer.appendSpace();
      }
      writer.append(v.name);
      if (v.value) {
        writer.appendBinaryOp("=");
        writer.append(v.value);
      }
    });
  }
}
export interface SetPropertyValue {
  property: string;
  value: ValueExpr;
}
export class AssignmentExpr extends Expr {
  public constructor(public readonly propertyValuesList: SetPropertyValue[]) {
    super(ExpressionType.Assignment);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.Assignment) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.Assignment'. ${JSON.stringify(node)}`);
    }
    const properties = node.properties as string[];
    const values = node.properties as NativeECSqlParseNode[];
    const propertyValuesList: SetPropertyValue[] = [];
    for (let i = 0; i < properties.length; ++i) {
      propertyValuesList.push({
        property: properties[i],
        value: ValueExpr.deserialize(values[i])
      });
    }
    return new AssignmentExpr(propertyValuesList);
  }
  public writeTo(writer: ECSqlWriter): void {
    this.propertyValuesList.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.append(v.property);
      writer.appendBinaryOp("=");
      writer.appendExp(v.value);
    });
  }
}

export class IIFExpr extends ValueExpr {
  public constructor(public readonly whenExp: BooleanExpr, public readonly thenExp: ValueExpr, public readonly elseExp: ValueExpr) {
    super(ExpressionType.IIF);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.IIF) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.IIF'. ${JSON.stringify(node)}`);
    }
    return new IIFExpr(BooleanExpr.deserialize(node.when as NativeECSqlParseNode), ValueExpr.deserialize(node.then as NativeECSqlParseNode), ValueExpr.deserialize(node.else as NativeECSqlParseNode));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("IIF");
    writer.append("(");
    writer.appendExp(this.whenExp);
    writer.appendComma();
    writer.appendExp(this.thenExp);
    writer.appendComma();
    writer.appendExp(this.elseExp);
    writer.append(")");
  }
}
export interface WhenThenBlock {
  when: BooleanExpr;
  then: ValueExpr;
}

export class SearchCaseExpr extends ValueExpr {
  public constructor(public readonly whenThenList: WhenThenBlock[], public readonly elseExp?: ValueExpr) {
    super(ExpressionType.SearchCase);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.SearchCaseValue) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.SearchCaseValue'. ${JSON.stringify(node)}`);
    }
    const whenThenList: WhenThenBlock[] = [];
    for (const whenThenProps of node.whenThenList as NativeECSqlParseNode[]) {
      whenThenList.push({
        when: BooleanExpr.deserialize(whenThenProps.when as NativeECSqlParseNode),
        then: ValueExpr.deserialize(whenThenProps.then as NativeECSqlParseNode),
      });
    }
    const elseExp = node.elseExp ? ValueExpr.deserialize(node.elseExp as NativeECSqlParseNode) : undefined;
    return new SearchCaseExpr(whenThenList, elseExp);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("CASE");
    this.whenThenList.forEach((v) => {
      writer.appendSpace();
      writer.appendKeyword("WHEN");
      writer.appendSpace();
      writer.appendExp(v.when);
      writer.appendSpace();
      writer.appendKeyword("THEN");
      writer.appendSpace();
      writer.appendExp(v.then);
    })
    if (this.elseExp) {
      writer.appendSpace();
      writer.appendKeyword("ELSE");
      writer.appendSpace();
      writer.appendExp(this.elseExp);
    }
    writer.appendSpace();
    writer.appendKeyword("END");
  }
}

export class BinaryValueExpr extends ValueExpr {
  public constructor(public readonly op: BinaryValueOp, public readonly lhs: ValueExpr, public readonly rhs: ValueExpr) {
    super(ExpressionType.BinaryValue);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryValue && node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryValue' . ${JSON.stringify(node)}`);
    }
    return new BinaryValueExpr(node.op as BinaryValueOp, ValueExpr.deserialize(node.lhs as NativeECSqlParseNode), ValueExpr.deserialize(node.rhs as NativeECSqlParseNode));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append("(");
    writer.appendExp(this.lhs);;
    writer.appendBinaryOp(this.op);
    writer.appendExp(this.rhs);;
    writer.append(")");
  }
}

export class CastExpr extends ValueExpr {
  public constructor(public readonly value: ValueExpr, public readonly targetType: string) {
    super(ExpressionType.Cast);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.Cast) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.CastExp'. ${JSON.stringify(node)}`);
    }
    return new CastExpr(ValueExpr.deserialize(node.exp as NativeECSqlParseNode), node.as as string);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("CAST");
    writer.append("(");
    writer.appendExp(this.value);
    writer.appendSpace();
    writer.appendKeyword("AS");
    writer.appendSpace();
    writer.append(this.targetType);
    writer.append(")");
  }
}
export class MemberFuncCallExpr extends Expr {
  public constructor(public readonly functionName: string, public readonly args: ValueExpr[]) {
    super(ExpressionType.MemberFuncCall);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.MemberFunctionCall) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.MemberFunctionCall'. ${JSON.stringify(node)}`);
    }

    const args = Array.from((node.args as NativeECSqlParseNode[]).map((v) => ValueExpr.deserialize(v)));
    return new MemberFuncCallExpr(node.name as string, args);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append(this.functionName);
    writer.append("(");
    this.args.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
    writer.append(")");
  }
}
export class FuncCallExpr extends ValueExpr {
  public constructor(public readonly functionName: string, public readonly args: ValueExpr[], public readonly rowQuantifier?: AllOrDistinctOp) {
    super(ExpressionType.FuncCall);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.FunctionCall) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.FunctionCall'. ${JSON.stringify(node)}`);
    }

    const args = Array.from((node.args as NativeECSqlParseNode[]).map((v) => ValueExpr.deserialize(v)));
    const rowQuantifier = node.quantifier ? node.quantifier as AllOrDistinctOp : undefined;
    return new FuncCallExpr(node.name as string, args, rowQuantifier);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append(this.functionName);
    writer.append("(");
    if (this.rowQuantifier) {
      writer.appendKeyword(this.rowQuantifier);
      writer.appendSpace();
    }
    this.args.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
    writer.append(")");
  }
}
export class ParameterExpr extends ValueExpr {
  public constructor(public readonly name?: string) {
    super(ExpressionType.Parameter);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.Parameter) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.Parameter'. ${JSON.stringify(node)}`);
    }
    return new ParameterExpr(node.name as string);
  }
  public writeTo(writer: ECSqlWriter): void {
    if (this.name && this.name !== "")
      writer.append(`:[${this.name}]`);
    else
      writer.append(`?`);
  }
}
export class UnaryValueExpr extends ValueExpr {
  public constructor(public readonly op: UnaryValueOp, public readonly value: ValueExpr) {
    super(ExpressionType.Unary);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.UnaryValue && node.id !== NativeExpIds.BooleanFactor) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.UnaryValue  && node.id !== NativeExpIds.BooleanFactor'. ${JSON.stringify(node)}`);
    }
    if (node.op !== UnaryValueOp.Plus && node.op !== UnaryValueOp.Minus && node.op !== UnaryValueOp.BitwiseNot) {
      throw new Error(`Unrecognized operator in .node.op'. Must me on of UnaryOp. ${JSON.stringify(node)}`);
    }
    return new UnaryValueExpr(node.op as UnaryValueOp, ValueExpr.deserialize(node.exp as NativeECSqlParseNode));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append(this.op);
    writer.appendExp(this.value);
  }
}

export class LiteralExpr extends ValueExpr {
  public constructor(public readonly valueType: LiteralValueType, public readonly rawValue: string) {
    super(ExpressionType.Literal);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.LiteralValue) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.LiteralValue'. ${JSON.stringify(node)}`);
    }
    return new LiteralExpr(node.kind as LiteralValueType, node.value as string);
  }
  public writeTo(writer: ECSqlWriter): void {
    if (this.valueType === LiteralValueType.String)
      writer.appendStringLiteral(this.rawValue);
    else if (this.valueType === LiteralValueType.Date)
      writer.appendKeyword("DATE").appendSpace().appendStringLiteral(this.rawValue);
    else if (this.valueType === LiteralValueType.Time)
      writer.appendKeyword("TIME").appendSpace().appendStringLiteral(this.rawValue);
    else if (this.valueType === LiteralValueType.Timestamp)
      writer.appendKeyword("TIMESTAMP").appendSpace().appendStringLiteral(this.rawValue);
    else if (this.valueType === LiteralValueType.Null)
      writer.appendKeyword("NULL");
    else
      writer.append(this.rawValue);
  }
  public static createString(val: string) { return new LiteralExpr(LiteralValueType.String, val); }
  public static createNumber(val: number) { return new LiteralExpr(LiteralValueType.Raw, val.toString()); }
  public static createDate(val: Date) { return new LiteralExpr(LiteralValueType.Date, val.toDateString()); }
  public static createTime(val: Date) { return new LiteralExpr(LiteralValueType.String, val.toTimeString()); }
  public static createTimestamp(val: Date) { return new LiteralExpr(LiteralValueType.String, val.toTimeString()); }
  public static createNull() { return new LiteralExpr(LiteralValueType.Null, ""); }
}
export class PropertyNameExpr extends ValueExpr {
  public constructor(public readonly propertyPath: string) {
    super(ExpressionType.PropertyName);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.PropertyName) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.PropertyNameExp'. ${JSON.stringify(node)}`);
    }
    return new PropertyNameExpr(node.path as string);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append(this.propertyPath);
  }
}