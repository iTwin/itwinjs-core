import { asInstanceOf, Constructor, isInstanceOf } from "@itwin/core-bentley";

/**
 * Unary operator for @ref ValueExpr.
 */
export enum UnaryValueOp {
  Minus = "-",
  Plus = "+",
  BitwiseNot = "~",
}

/**
 * Unary operator for @ref BooleanExpr
 */
export enum UnaryBooleanOp {
  Not = "NOT",
}
/**
 * Id returned by native code
 * @internal
 */
enum NativeExpIds {
  AllOrAny = "AllOrAnyExp", /** Not supported or working */
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
  Subquery = "SubqueryExp",
}
/**
 * Binary boolean operators used by @ref BinaryBooleanExpr
 */
export enum BinaryBooleanOp {
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

/**
 * Binary value operators used by @ref BinaryValueExpr
 */
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
}

/**
 * Disqualify term in ECSQL so query planner does not try to find index for it.
 */
export type DisqualifyOp = "+";

/**
 * Optional recursive keyword for common table expressions @ref CteExpr
 */
export type RecursiveCte = "RECURSIVE";

/**
 * Polymorphic constraint for @ref ClassNameExpr
 */
export enum OnlyOrAllOp {
  Only = "ONLY",
  All = "ALL",
}

/**
 * Filter rows in select clause or aggregate functions
 */
export enum AllOrDistinctOp {
  Distinct = "DISTINCT",
  All = "ALL",
}

/**
 * Return by native code
 */
export interface NativeECSqlParseNode {
  [key: string]: any;
}

/**
 * ECSql expr type supported
 */
export enum ExprType {
  Literal = "Literal",
  Unary = "Unary",
  Parameter = "Parameter",
  Cast = "Cast",
  BinaryValue = "BinaryValue",
  SearchCase = "SearchCase",
  IIF = "IIF",
  FuncCall = "FuncCall",
  PropertyName = "PropertyName",
  SubqueryValue = "SubqueryValue",

  Between = "Between",
  // Match = "Match",
  Like = "Like",
  In = "InExp",
  Not = "Not",
  IsOfType = "IsOfType",
  IsNull = "IsNull",
  BinaryBoolean = "BinaryBoolean",
  SubqueryTest = "SubqueryTest",

  UsingRelationshipJoin = "UsingRelationshipJoin",
  QualifiedJoin = "QualifiedJoin",
  SubqueryRef = "SubqueryRef",
  CteBlockRef = "CteBlockRef",
  ClassName = "ClassName",
  TableValuedFunc = "TableValuedFunc",

  DerivedProperty = "DerivedProperty",
  AssignmentClause = "Assignment",
  Select = "SingleSelect",
  ECSqlOptions = "ECSqlOptions",
  CteBlock = "CteBlock",
  MemberFuncCall = "MemberFuncCallExp",

  Cte = "Cte",
  UpdateStatement = "Update",
  InsertStatement = "Insert",
  DeleteStatement = "Delete",
  SelectStatement = "Select",
  SelectionClause = "SelectionClause",

  WhereClause = "WhereClause",
  GroupByClause = "GroupByClause",
  HavingClause = "HavingCluase",
  FromClause = "FromClause",
  OrderByClause = "OrderByClause",
  OrderBySpec = "OrderBySpec",
  LimitClause = "LimitClause"
}
/**
 * Base class for all ECSql expressions.
 */
export abstract class Expr {
  public constructor(public readonly expType: ExprType) { }
  public abstract writeTo(writer: ECSqlWriter): void;
  public isInstanceOf<T extends Expr>(type: Constructor<T>) { return isInstanceOf<T>(this, type); }
  public asInstanceOf<T extends Expr>(type: Constructor<T>) { return asInstanceOf<T>(this, type); }
  public toECSql(args?: ECSqlWriterArgs): string {
    if (args) {
      const customWriter = new ECSqlWriter(args);
      this.writeTo(customWriter);
      return customWriter.toString();
    }
    const defaultWriter = new ECSqlWriter();
    this.writeTo(defaultWriter);
    return defaultWriter.toString();
  }
}
export abstract class StatementExpr extends Expr {
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
  public static override deserialize(node: NativeECSqlParseNode): BooleanExpr | SubqueryTestExpr | BetweenExpr | LikeExpr | InExpr | IsNullExpr | IsOfTypeExpr | NotExpr | BinaryBooleanExpr {
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
      return SubqueryTestExpr.deserialize(node);
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
    NativeExpIds.Subquery,
  ];

  public static override deserialize(node: NativeECSqlParseNode): SubqueryExpr | ValueExpr | UnaryValueExpr | FuncCallExpr | CastExpr | BinaryValueExpr | SearchCaseExpr | IIFExpr | LiteralExpr | PropertyNameExpr {
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
    if (node.id === NativeExpIds.Subquery) {
      return SubqueryExpr.deserialize(node);
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
    NativeExpIds.CommonTableBlockName,
  ];

  public static deserialize(node: NativeECSqlParseNode): ClassRefExpr | ClassNameExpr | SubqueryRefExpr | UsingRelationshipJoinExpr | QualifiedJoinExpr | CteBlockRefExpr | TableValuedFuncExpr {
    if (node.id === NativeExpIds.ClassName) {
      return ClassNameExpr.deserialize(node);
    }
    if (node.id === NativeExpIds.SubqueryRef) {
      return SubqueryRefExpr.deserialize(node);
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
    if (node.id === NativeExpIds.TableValuedFunction) {
      return TableValuedFuncExpr.deserialize(node);
    }

    throw new Error(`Unknown type of native value exp ${node.id}`);
  }
}

export interface ECSqlWriterArgs {
  readonly multiline: boolean;
  readonly eol: "\r\n" | "\n";
  readonly spaceAfterComma: boolean;
  readonly spaceAroundBinOp: boolean;
  readonly keywordCasing: "lower" | "UPPER";
  readonly indent: {
    readonly size: number;
    readonly char: string;
  };
}
export type Keywords = "ALL" | "AND" | "AS" | "ASC" | "BACKWARD" | "BETWEEN" | "BY"
  | "CASE" | "CAST" | "CROSS" | "DATE" | "DELETE" | "DESC" | "DISTINCT" | "ECSQLOPTIONS"
  | "ELSE" | "END" | "ESCAPE" | "EXCEPT" | "EXISTS" | "FORWARD" | "FROM" | "FULL"
  | "GROUP" | "HAVING" | "IIF" | "IN" | "INNER" | "INSERT" | "INTERSECT" | "INTO"
  | "IS" | "JOIN" | "LEFT" | "LIKE" | "LIMIT" | "NATURAL" | "NOT" | "NULL" | "OFFSET" | "ON"
  | "ONLY" | "OR" | "ORDER" | "OUTER" | "RECURSIVE" | "RIGHT" | "SELECT" | "SET" | "THEN"
  | "TIME" | "TIMESTAMP" | "UNION" | "UPDATE" | "USING" | "VALUES" | "WHEN" | "WHERE" | "WITH";
/**
 * Write expression tree to string
 */
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
    indent: { size: 3, char: " " },
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
  public appendQuoted(val: string) {
    return this.append(`[${val}]`);
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

export enum CompoundSelectOp {
  Union = "UNION",
  UnionAll = "UNION ALL",
  Intersect = "INTERSECT",
  Except = "EXCEPT"
}
export interface NextSelect {
  op: CompoundSelectOp;
  select: SelectStatementExpr;
}
export enum SubqueryTestOp {
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
  // Cross = "CROSS JOIN", broken on ECDb side
  // Natural = "NATURAL", brokean but will not work with ECSQL
}
export class DerivedPropertyExpr extends Expr {
  public constructor(public readonly exp: ComputedExpr, public readonly alias?: string) {
    super(ExprType.DerivedProperty);
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
      writer.appendQuoted(this.alias);
    }
  }
}
export class DeleteStatementExpr extends StatementExpr {
  public constructor(
    public readonly className: ClassNameExpr,
    public readonly where?: WhereClauseExp,
    public readonly options?: ECSqlOptionsClauseExpr) {
    super(ExprType.DeleteStatement);
  }
  public static override deserialize(node: NativeECSqlParseNode): DeleteStatementExpr {
    if (node.id !== NativeExpIds.DeleteStatement) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.DeleteStatement'. ${JSON.stringify(node)}`);
    }

    const className = ClassNameExpr.deserialize(node.class as NativeECSqlParseNode);
    const where = node.where ? WhereClauseExp.deserialize(node.where as NativeECSqlParseNode) : undefined;
    const options = node.options ? ECSqlOptionsClauseExpr.deserialize(node.options as NativeECSqlParseNode) : undefined;
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
    super(ExprType.InsertStatement);
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
    super(ExprType.QualifiedJoin);
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
    if (this.joinType === JoinType.LeftOuter) {
      writer.appendKeyword("LEFT").appendSpace();
      writer.appendKeyword("OUTER").appendSpace();
      writer.appendKeyword("JOIN").appendSpace();
    } else if (this.joinType === JoinType.RightOuter) {
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
    } else {
      throw new Error(`not supported join type ${this.joinType}`);
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
    public readonly fromClassName: ClassRefExpr,
    public readonly toClassName: ClassNameExpr,
    public readonly toRelClassName: ClassNameExpr,
    public readonly direction?: JoinDirection) {
    super(ExprType.UsingRelationshipJoin);
  }
  public static override deserialize(node: NativeECSqlParseNode): UsingRelationshipJoinExpr {
    if (node.id !== NativeExpIds.UsingRelationshipJoinExp) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.UsingRelationshipJoinExp'. ${JSON.stringify(node)}`);
    }
    const from = ClassRefExpr.deserialize(node.from as NativeECSqlParseNode);
    const to = ClassNameExpr.deserialize(node.to as NativeECSqlParseNode);
    const usingRel = ClassNameExpr.deserialize(node.using as NativeECSqlParseNode);
    const direction = node.direction ? node.direction as JoinDirection : undefined;
    return new UsingRelationshipJoinExpr(from, to, usingRel, direction);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.fromClassName);
    writer.appendSpace();
    writer.appendKeyword("JOIN");
    writer.appendSpace();
    writer.appendExp(this.toClassName);
    writer.appendSpace();
    writer.appendKeyword("USING");
    writer.appendSpace();
    writer.appendExp(this.toRelClassName);
    if (this.direction) {
      writer.appendSpace();
      writer.appendKeyword(this.direction);
    }
  }
}
export class SubqueryTestExpr extends BooleanExpr {
  public constructor(public readonly op: SubqueryTestOp, public readonly query: SubqueryExpr) {
    super(ExprType.SubqueryTest);
  }
  public static override deserialize(node: NativeECSqlParseNode): SubqueryTestExpr {
    if (node.id !== NativeExpIds.SubqueryTest) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.SubqueryTest'. ${JSON.stringify(node)}`);
    }
    const query = SubqueryExpr.deserialize(node.query as NativeECSqlParseNode);
    const op = node.op as SubqueryTestOp;
    return new SubqueryTestExpr(op, query);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword(this.op);
    writer.appendExp(this.query);
  }
}

export class SubqueryRefExpr extends ClassRefExpr {
  public constructor(public readonly query: SubqueryExpr, public readonly polymorphicInfo?: PolymorphicInfo, public readonly alias?: string) {
    super(ExprType.SubqueryRef);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.SubqueryRef) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.SubqueryRef'. ${JSON.stringify(node)}`);
    }
    const query = SubqueryExpr.deserialize(node.query as NativeECSqlParseNode);
    const polymorphicInfo = node.polymorphicInfo ? node.polymorphicInfo as PolymorphicInfo : undefined;
    const alias = node.alias ? node.alias as string : undefined;
    return new SubqueryRefExpr(query, polymorphicInfo, alias);
  }
  public override writeTo(writer: ECSqlWriter): void {
    if (this.polymorphicInfo) {
      if (this.polymorphicInfo.disqualify) {
        writer.append(this.polymorphicInfo.disqualify);
      }
      writer.appendKeyword(this.polymorphicInfo.scope);
      writer.appendSpace();
    }
    writer.appendExp(this.query);
    if (this.alias) {
      writer.appendSpace();
      writer.appendQuoted(this.alias);
    }
  }
}
export class SelectStatementExpr extends StatementExpr {
  public constructor(public readonly singleSelect: SelectExpr, public readonly nextSelect?: NextSelect) {
    super(ExprType.SelectStatement);
  }
  public static override deserialize(node: NativeECSqlParseNode): SelectStatementExpr {
    if (node.id !== NativeExpIds.SelectStatement) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.SelectStatement'. ${JSON.stringify(node)}`);
    }
    const singleSelect = SelectExpr.deserialize(node.select as NativeECSqlParseNode);
    let nextSelect: NextSelect | undefined;
    if (node.nextBlock) {
      nextSelect = {
        op: node.nextBlock.combineOp as CompoundSelectOp,
        select: SelectStatementExpr.deserialize(node.nextBlock.select as NativeECSqlParseNode),
      }
    }
    return new SelectStatementExpr(singleSelect, nextSelect);
  }
  public override writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.singleSelect);
    if (this.nextSelect) {
      writer.appendSpace();
      if (this.nextSelect.op === CompoundSelectOp.UnionAll) {
        writer.appendKeyword("UNION");
        writer.appendSpace();
        writer.appendKeyword("ALL");
      } else {
        writer.append(this.nextSelect.op);
      }
      writer.appendSpace();
      writer.appendExp(this.nextSelect.select);
    }
  }
}
export class SelectionClauseExpr extends Expr {
  public constructor(public readonly derivedPropertyList: DerivedPropertyExpr[]) {
    super(ExprType.SelectionClause);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (!Array.isArray(node)) {
      throw new Error(`Expect node to be array of NativeECSqlParseNode[] ${JSON.stringify(node)}`);
    }
    return new SelectionClauseExpr(Array.from(node.map((v) => DerivedPropertyExpr.deserialize(v))));
  }
  public writeTo(writer: ECSqlWriter): void {
    this.derivedPropertyList.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
  }
}
export class GroupByClauseExpr extends Expr {
  public constructor(public readonly exprList: ValueExpr[]) {
    super(ExprType.GroupByClause);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (!Array.isArray(node)) {
      throw new Error(`Expect node to be array of NativeECSqlParseNode[] ${JSON.stringify(node)}`);
    }
    return new GroupByClauseExpr(Array.from(node.map((v) => ValueExpr.deserialize(v))));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("GROUP");
    writer.appendSpace();
    writer.appendKeyword("BY");
    writer.appendSpace();
    this.exprList.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
  }
}
export class HavingClauseExpr extends Expr {
  public constructor(public readonly filterExpr: ComputedExpr) {
    super(ExprType.HavingClause);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (typeof node !== "object") {
      throw new Error(`Expect node to be array of NativeECSqlParseNode ${JSON.stringify(node)}`);
    }
    return new HavingClauseExpr(BooleanExpr.deserialize(node));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("HAVING");
    writer.appendSpace();
    writer.appendExp(this.filterExpr);
  }
}
export class FromClauseExpr extends Expr {
  public constructor(public readonly classRefs: ClassRefExpr[]) {
    super(ExprType.FromClause);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (!Array.isArray(node)) {
      throw new Error(`Expect node to be array of NativeECSqlParseNode[] ${JSON.stringify(node)}`);
    }
    return new FromClauseExpr(Array.from(node.map((v) => ClassRefExpr.deserialize(v))));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("FROM");
    writer.appendSpace();
    this.classRefs.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
  }
}
export class WhereClauseExp extends Expr {
  public constructor(public readonly filterExpr: ComputedExpr) {
    super(ExprType.WhereClause);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (typeof node !== "object") {
      throw new Error(`Expect node to be array of NativeECSqlParseNode ${JSON.stringify(node)}`);
    }
    return new WhereClauseExp(BooleanExpr.deserialize(node));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("WHERE");
    writer.appendSpace();
    writer.appendExp(this.filterExpr);
  }
}
export class OrderBySpecExpr extends Expr {
  public constructor(public readonly term: ValueExpr, public readonly sortDirection?: SortDirection) {
    super(ExprType.OrderBySpec);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (typeof node !== "object") {
      throw new Error(`Expect node to be array of NativeECSqlParseNode ${JSON.stringify(node)}`);
    }
    return new OrderBySpecExpr(ValueExpr.deserialize(node.exp), node.direction ? node.direction as SortDirection : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.term);
    if (this.sortDirection) {
      writer.appendSpace();
      writer.appendKeyword(this.sortDirection);
    }
  }
}
export class OrderByClauseExpr extends Expr {
  public constructor(public readonly terms: OrderBySpecExpr[]) {
    super(ExprType.OrderByClause);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (!Array.isArray(node)) {
      throw new Error(`Expect node to be array of NativeECSqlParseNode[] ${JSON.stringify(node)}`);
    }
    return new OrderByClauseExpr(Array.from(node.map((v) => OrderBySpecExpr.deserialize(v))));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("ORDER");
    writer.appendSpace();
    writer.appendKeyword("BY");
    writer.appendSpace();
    this.terms.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendExp(v);
    });
  }
}

export class LimitClauseExpr extends Expr {
  public constructor(public readonly limit: ValueExpr, public readonly offset?: ValueExpr) {
    super(ExprType.LimitClause);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (typeof node !== "object") {
      throw new Error(`Expect node to be array of NativeECSqlParseNode ${JSON.stringify(node)}`);
    }
    return new LimitClauseExpr(ValueExpr.deserialize(node.exp), node.offset ? ValueExpr.deserialize(node.offset as NativeECSqlParseNode) : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("LIMIT");
    writer.appendSpace();
    writer.appendExp(this.limit);
    if (this.offset) {
      writer.appendSpace();
      writer.appendKeyword("OFFSET");
      writer.appendSpace();
      writer.appendExp(this.offset);
    }
  }
}
export class SelectExpr extends Expr {
  public constructor(
    public readonly selection: SelectionClauseExpr,
    public readonly rowQuantifier?: AllOrDistinctOp,
    public readonly from?: FromClauseExpr,
    public readonly where?: WhereClauseExp,
    public readonly groupBy?: GroupByClauseExpr,
    public readonly having?: HavingClauseExpr,
    public readonly orderBy?: OrderByClauseExpr,
    public readonly limit?: LimitClauseExpr,
    public readonly options?: ECSqlOptionsClauseExpr) {
    super(ExprType.Select);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.SingleSelectStatement && node.id !== NativeExpIds.RowConstructor) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.SingleSelectStatement/RowConstructor'. ${JSON.stringify(node)}`);
    }
    if (node.id === NativeExpIds.RowConstructor) {
      const values = SelectionClauseExpr.deserialize(node.values);
      return new SelectExpr(values);
    }
    const selection = SelectionClauseExpr.deserialize(node.selection);
    const from = node.from ? FromClauseExpr.deserialize(node.from) : undefined;
    const where = node.where ? WhereClauseExp.deserialize(node.where) : undefined;
    const groupBy = node.groupBy ? GroupByClauseExpr.deserialize(node.groupBy) : undefined;
    const having = node.having ? HavingClauseExpr.deserialize(node.having) : undefined;
    const orderBy = node.orderBy ? OrderByClauseExpr.deserialize(node.orderBy) : undefined;
    const options = node.options ? ECSqlOptionsClauseExpr.deserialize(node.options) : undefined;
    const limitSpec = node.limit ? LimitClauseExpr.deserialize(node.limit) : undefined;
    const rowQuantifier = node.selectionType ? node.selectionType as AllOrDistinctOp : undefined;
    return new SelectExpr(selection, rowQuantifier, from, where, groupBy, having, orderBy, limitSpec, options);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("SELECT");
    writer.appendSpace();
    if (this.rowQuantifier) {
      writer.appendKeyword(this.rowQuantifier);
      writer.appendSpace();
    }
    writer.appendExp(this.selection);

    if (this.from) {
      writer.appendSpace();
      writer.appendExp(this.from);
    }
    if (this.where) {
      writer.appendSpace();
      writer.appendExp(this.where);
    }
    if (this.groupBy) {
      writer.appendSpace();
      writer.appendExp(this.groupBy);
    }
    if (this.having) {
      writer.appendSpace();
      writer.appendExp(this.having);
    }
    if (this.orderBy) {
      writer.appendSpace();
      writer.appendExp(this.orderBy);
    }
    if (this.limit) {
      writer.appendSpace();
      writer.appendExp(this.limit);
    }
    if (this.options) {
      writer.appendSpace();
      writer.appendExp(this.options);
    }
  }
}
export class SubqueryExpr extends ValueExpr {
  public constructor(public readonly query: SelectStatementExpr) {
    super(ExprType.BinaryBoolean);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.Subquery) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.Subquery'. ${JSON.stringify(node)}`);
    }
    return new SubqueryExpr(SelectStatementExpr.deserialize(node.query as NativeECSqlParseNode));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append("(");
    writer.appendExp(this.query);
    writer.append(")");
  }
}
export class BinaryBooleanExpr extends BooleanExpr {
  public constructor(public readonly op: BinaryBooleanOp, public readonly lhs: ComputedExpr, public readonly rhs: ComputedExpr, public readonly not?: UnaryBooleanOp) {
    super(ExprType.BinaryBoolean);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryBoolean'. ${JSON.stringify(node)}`);
    }
    const op = node.op as BinaryBooleanOp;
    return new BinaryBooleanExpr(op, ComputedExpr.deserialize(node.lhs as NativeECSqlParseNode), ComputedExpr.deserialize(node.rhs as NativeECSqlParseNode));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append("(");
    writer.appendExp(this.lhs);
    writer.appendBinaryOp(this.op);
    writer.appendExp(this.rhs);
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
    super(ExprType.IsNull);
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
    super(ExprType.IsOfType);
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
    super(ExprType.Not);
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
  public constructor(public readonly lhs: ValueExpr, public readonly rhs: ValueExpr[] | SubqueryExpr, public readonly not?: UnaryBooleanOp) {
    super(ExprType.In);
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
    else if (node.rhs.id === NativeExpIds.Subquery)
      return new InExpr(lhs, SubqueryExpr.deserialize(node.rhs as NativeECSqlParseNode), isNull ? UnaryBooleanOp.Not : undefined);
    else
      throw new Error(`unknown IN rhs ${node.rhs.id}`);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.lhs);
    writer.appendSpace();
    if (this.not) {
      writer.appendKeyword("NOT");
      writer.appendSpace();
    }
    writer.appendKeyword("IN");
    writer.appendSpace();

    if (this.rhs instanceof SubqueryExpr) {
      writer.appendExp(this.rhs);
    } else if (Array.isArray(this.rhs)) {
      writer.append("(");
      this.rhs.forEach((v, i) => {
        if (i > 0) {
          writer.appendComma();
        }
        writer.appendExp(v);
      });
      writer.append(")");
    } else {
      throw new Error("unknown expression on rhs of IN expr.");
    }
  }
}
export class LikeExpr extends BooleanExpr {
  public constructor(public readonly lhs: ValueExpr, public readonly pattern: ValueExpr, public readonly escape?: ValueExpr, public readonly not?: UnaryBooleanOp) {
    super(ExprType.Like);
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
    writer.appendExp(this.lhs);
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
    super(ExprType.Between);
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
      upper: ValueExpr.deserialize(rhs.ubound as NativeECSqlParseNode),
    };
    return new BetweenExpr(ValueExpr.deserialize(node.lhs as NativeECSqlParseNode), bounds, isNull ? UnaryBooleanOp.Not : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendExp(this.lhs);
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
    super(ExprType.Cte);
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
    super(ExprType.CteBlock);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.CommonTableBlock) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.CommonTableBlock'. ${JSON.stringify(node)}`);
    }
    return new CteBlockExpr(node.name as string, SelectStatementExpr.deserialize(node.asQuery as NativeECSqlParseNode), node.args as string[]);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendQuoted(this.name);
    writer.append("(");
    this.props.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.appendQuoted(v);
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
    super(ExprType.CteBlockRef);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.CommonTableBlockName) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.CommonTableBlockName'. ${JSON.stringify(node)}`);
    }
    return new CteBlockRefExpr(node.name as string, node.alias ? node.alias as string : undefined);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendQuoted(this.name);
    if (this.alias) {
      writer.appendQuoted(this.alias);
    }
  }
}

export class TableValuedFuncExpr extends ClassRefExpr {
  public constructor(public readonly schemaName: string, public readonly memberFunc: MemberFuncCallExpr, public readonly alias?: string) {
    super(ExprType.TableValuedFunc);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.TableValuedFunction) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.TableValuedFunction'. ${JSON.stringify(node)}`);
    }
    return new TableValuedFuncExpr(node.schema as string, MemberFuncCallExpr.deserialize(node.func as NativeECSqlParseNode), node.alias as string);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendQuoted(this.schemaName);
    writer.append(".");
    writer.appendExp(this.memberFunc);
    if (this.alias) {
      writer.appendSpace();
      writer.appendQuoted(this.alias);
    }
  }
}
export class ClassNameExpr extends ClassRefExpr {
  public constructor(public readonly schemaNameOrAlias: string, public readonly className: string, public readonly tablespace?: string, public readonly alias?: string, public readonly polymorphicInfo?: PolymorphicInfo, public readonly memberFunc?: MemberFuncCallExpr) {
    super(ExprType.ClassName);
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
      writer.appendQuoted(this.alias);
    }
  }
}

export class UpdateStatementExpr extends StatementExpr {
  public constructor(public readonly className: string, public readonly assignement: AssignmentClauseExpr, public readonly where?: WhereClauseExp, public readonly options?: ECSqlOptionsClauseExpr) {
    super(ExprType.UpdateStatement);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.UpdateStatement) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.UpdateStatement'. ${JSON.stringify(node)}`);
    }
    const className = node.className as string;
    const assignment = AssignmentClauseExpr.deserialize(node.assignment as NativeECSqlParseNode);
    const where = node.where ? WhereClauseExp.deserialize(node.where as NativeECSqlParseNode) : undefined;
    const options = node.options ? ECSqlOptionsClauseExpr.deserialize(node.options as NativeECSqlParseNode) : undefined;
    return new UpdateStatementExpr(className, assignment, where, options);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("UPDATE");
    writer.appendSpace();
    writer.append(this.className);
    writer.appendSpace();
    writer.appendExp(this.assignement);
    if (this.where) {
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
export class ECSqlOptionsClauseExpr extends Expr {
  public constructor(public readonly options: ECSqlOption[]) {
    super(ExprType.ECSqlOptions);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.Options) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.Options'. ${JSON.stringify(node)}`);
    }
    return new ECSqlOptionsClauseExpr(node.options as ECSqlOption[]);
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
export interface PropertyValueAssignment {
  propertyName: string;
  valueExpr: ValueExpr;
}
export class AssignmentClauseExpr extends Expr {
  public constructor(public readonly propertyValuesList: PropertyValueAssignment[]) {
    super(ExprType.AssignmentClause);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.Assignment) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.Assignment'. ${JSON.stringify(node)}`);
    }
    const properties = node.properties as string[];
    const values = node.properties as NativeECSqlParseNode[];
    const propertyValuesList: PropertyValueAssignment[] = [];
    for (let i = 0; i < properties.length; ++i) {
      propertyValuesList.push({
        propertyName: properties[i],
        valueExpr: ValueExpr.deserialize(values[i]),
      });
    }
    return new AssignmentClauseExpr(propertyValuesList);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendKeyword("SET");
    writer.appendSpace();
    this.propertyValuesList.forEach((v, i) => {
      if (i > 0) {
        writer.appendComma();
      }
      writer.append(v.propertyName);
      writer.appendBinaryOp("=");
      writer.appendExp(v.valueExpr);
    });
  }
}

export class IIFExpr extends ValueExpr {
  public constructor(public readonly whenExp: BooleanExpr, public readonly thenExp: ValueExpr, public readonly elseExp: ValueExpr) {
    super(ExprType.IIF);
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
    super(ExprType.SearchCase);
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
    });
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
    super(ExprType.BinaryValue);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.BinaryValue && node.id !== NativeExpIds.BinaryBoolean) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.BinaryValue' . ${JSON.stringify(node)}`);
    }
    return new BinaryValueExpr(node.op as BinaryValueOp, ValueExpr.deserialize(node.lhs as NativeECSqlParseNode), ValueExpr.deserialize(node.rhs as NativeECSqlParseNode));
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.append("(");
    writer.appendExp(this.lhs);
    writer.appendBinaryOp(this.op);
    writer.appendExp(this.rhs);
    writer.append(")");
  }
}

/**
 * Cast a expression into a target time e.g. CAST(<expr> AS STRING)
 */
export class CastExpr extends ValueExpr {
  public constructor(public readonly value: ValueExpr, public readonly targetType: string) {
    super(ExprType.Cast);
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
/**
 * Represent a member function called w.r.t a @ref ClassNameExpr
 */
export class MemberFuncCallExpr extends Expr {
  public constructor(public readonly functionName: string, public readonly args: ValueExpr[]) {
    super(ExprType.MemberFuncCall);
  }
  public static deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.MemberFunctionCall) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.MemberFunctionCall'. ${JSON.stringify(node)}`);
    }

    const args = Array.from((node.args as NativeECSqlParseNode[]).map((v) => ValueExpr.deserialize(v)));
    return new MemberFuncCallExpr(node.name as string, args);
  }
  public writeTo(writer: ECSqlWriter): void {
    writer.appendQuoted(this.functionName);
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

/**
 * Represent a function call in ecsql
 */
export class FuncCallExpr extends ValueExpr {
  public constructor(public readonly functionName: string, public readonly args: ValueExpr[], public readonly rowQuantifier?: AllOrDistinctOp) {
    super(ExprType.FuncCall);
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
/**
 * Represent positional or named parameter
 */
export class ParameterExpr extends ValueExpr {
  public constructor(public readonly name?: string) {
    super(ExprType.Parameter);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.Parameter) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.Parameter'. ${JSON.stringify(node)}`);
    }
    return new ParameterExpr(node.name as string);
  }
  public writeTo(writer: ECSqlWriter): void {
    if (this.name && this.name !== "")
      writer.append(`:${this.name}`);
    else
      writer.append(`?`);
  }
}

/**
 * Unary value with operator e.g. [+|-|~]<number>
 */
export class UnaryValueExpr extends ValueExpr {
  public constructor(public readonly op: UnaryValueOp, public readonly value: ValueExpr) {
    super(ExprType.Unary);
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
/**
 * Represent constant literal like string, data, time, timestamp, number or null
 */
export class LiteralExpr extends ValueExpr {
  public constructor(public readonly valueType: LiteralValueType, public readonly rawValue: string) {
    super(ExprType.Literal);
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
  public static createRaw(val: string) { return new LiteralExpr(LiteralValueType.Raw, val); }
  public static createString(val: string) { return new LiteralExpr(LiteralValueType.String, val); }
  public static createNumber(val: number) { return new LiteralExpr(LiteralValueType.Raw, val.toString()); }
  public static createDate(val: Date) { return new LiteralExpr(LiteralValueType.Date, val.toDateString()); }
  public static createTime(val: Date) { return new LiteralExpr(LiteralValueType.String, val.toTimeString()); }
  public static createTimestamp(val: Date) { return new LiteralExpr(LiteralValueType.String, val.toTimeString()); }
  public static createNull() { return new LiteralExpr(LiteralValueType.Null, ""); }
}
/**
 * Represent property name identifier
 */
export class PropertyNameExpr extends ValueExpr {
  public constructor(public readonly propertyPath: string) {
    super(ExprType.PropertyName);
  }
  public static override deserialize(node: NativeECSqlParseNode) {
    if (node.id !== NativeExpIds.PropertyName) {
      throw new Error(`Parse node is 'node.id !== NativeExpIds.PropertyNameExp'. ${JSON.stringify(node)}`);
    }
    return new PropertyNameExpr(node.path as string);
  }
  public writeTo(writer: ECSqlWriter): void {
    // donot quote $
    const str = this.propertyPath.split("->");
    if (str.length === 2) {
      writer.append(str[0].split(".").map((v) => v.startsWith("[") || v === "$" ? v : `[${v}]`).join("."));
      writer.append("->");
    }
    writer.append(str[str.length - 1].split(".").map((v) => v.startsWith("[") || v === "$" ? v : `[${v}]`).join("."));
  }
}
