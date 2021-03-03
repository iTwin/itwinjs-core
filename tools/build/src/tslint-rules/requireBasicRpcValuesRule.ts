/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as Lint from "tslint";
import * as ts from "typescript";

const LOCKED = Symbol("LOCKED");

export class Rule extends Lint.Rules.TypedRule {
  public static FAILURE_STRING = "Unsupported RPC value.";

  private _checker: ts.TypeChecker = undefined as any;
  private _ctx: Lint.WalkContext<Lint.IOptions> = undefined as any;

  public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
    this._checker = program.getTypeChecker();

    return this.applyWithFunction(sourceFile, (ctx) => {
      this._ctx = ctx;
      ts.forEachChild(ctx.sourceFile, (n) => this.walk(n));
    }, this.getOptions());
  }

  private walk(node: ts.Node) {
    if (node.kind === ts.SyntaxKind.ClassDeclaration) {
      this.checkClassDeclaration(node as ts.ClassDeclaration);
    } else if (node.kind === ts.SyntaxKind.CallExpression) {
      this.checkCallExpression(node as ts.CallExpression);
    } else if (node.kind === ts.SyntaxKind.ReturnStatement) {
      this.checkReturnStatement(node as ts.ReturnStatement);
    }

    ts.forEachChild(node, (n) => this.walk(n));
  }

  private checkReturnStatement(node: ts.ReturnStatement): void {
    if (!this.isRpcReturn(node)) {
      return;
    }

    for (const child of node.getChildren()) {
      const type = this._checker.getTypeAtLocation(child);
      this.checkNode(child, type, "");
    }
  }

  private isRpcReturn(_node: ts.Node): boolean {
    let node = _node;
    for (; ;) {
      if (node.kind === ts.SyntaxKind.MethodDeclaration && this.isStatic(node)) {
        return false;
      }

      if (node.parent.kind === ts.SyntaxKind.ClassDeclaration) {
        return this.isRpcInterface(node.parent as ts.ClassLikeDeclaration);
      } else if (node.parent.kind === ts.SyntaxKind.SourceFile) {
        return false;
      } else {
        node = node.parent;
      }
    }
  }

  private checkCallExpression(node: ts.CallExpression): void {
    const signature = this._checker.getResolvedSignature(node);
    if (signature) {
      const declaration = signature.getDeclaration();
      if (!declaration || !declaration.parent) {
        return;
      }

      if (ts.isClassDeclaration(declaration.parent) && this.isRpcInterface(declaration.parent)) {
        for (const argument of node.arguments) {
          const type = this._checker.getTypeAtLocation(argument);
          this.checkNode(argument, type, "");
        }
      }
    }
  }

  private checkClassDeclaration(node: ts.ClassDeclaration): void {
    if (this.isRpcInterface(node)) {
      node.forEachChild((child) => {
        if (child.kind !== ts.SyntaxKind.MethodDeclaration || this.isStatic(child)) {
          return;
        }

        const method = child as ts.MethodDeclaration;
        this.checkParameters(method);
        this.checkReturnType(method);
      });
    }
  }

  private checkParameters(method: ts.MethodDeclaration) {
    for (const param of method.parameters) {
      if (!param.type) {
        continue;
      }

      const type = this._checker.getTypeFromTypeNode(param.type);
      this.checkNode(param, type, "");
    }
  }

  private checkReturnType(method: ts.MethodDeclaration) {
    const signature = this._checker.getSignatureFromDeclaration(method);
    if (signature) {
      this.checkNode(signature.getDeclaration().type, signature.getReturnType(), "");
    }
  }

  private isStatic(node: ts.Node) {
    if (node.modifiers) {
      for (const modifier of node.modifiers) {
        if (modifier.kind === ts.SyntaxKind.StaticKeyword) {
          return true;
        }
      }
    }

    return false;
  }

  private resolveReferences(_type: ts.Type): { type: ts.Type, base: string } {
    let type = _type;
    let base = type.symbol ? type.symbol.getName() : "";

    for (; ;) {
      const asRef = type as ts.TypeReference;
      if (asRef.typeArguments && asRef.typeArguments.length && (base === "Array" || base === "Promise")) {
        type = asRef.typeArguments[0];
        base = type.symbol ? type.symbol.getName() : "";
      } else {
        const bases = type.getBaseTypes();
        if (bases && bases.length === 1 && bases[0].symbol && bases[0].symbol.name === "Array") {
          const baseRef = bases[0] as ts.TypeReference;
          if (baseRef.typeArguments && baseRef.typeArguments.length) {
            type = baseRef.typeArguments[0];
            base = type.symbol ? type.symbol.getName() : "";
            continue;
          }
        }

        break;
      }
    }

    return { type, base };
  }

  private checkNode(node: ts.Node | undefined, _type: ts.Type, scope: string): boolean {
    const { type, base } = this.resolveReferences(_type);

    const typeAny = type as any;
    if (typeAny[LOCKED]) {
      return true;
    }

    typeAny[LOCKED] = true;

    let failure = false;
    let childFailure = false;
    let message = Rule.FAILURE_STRING;

    if (type.isClass()) {
      failure = true;
      message += `\n"${scope ? (`${scope}.`) : ""}${type.symbol.getName()}" is a class.`;
    } else if (!this.isPrimitive(type)) {
      const asObject = type as ts.ObjectType;

      if (asObject.objectFlags && asObject.objectFlags === ts.ObjectFlags.Reference) {
        const asRef = asObject as ts.TypeReference;
        if (asRef.typeArguments) {
          let t = 0;
          for (const member of asRef.typeArguments) {
            if (!this.checkNode(node, member, `${scope || base}.[${t}]`)) {
              childFailure = true;
            }
            ++t;
          }
        }
      } else if (type.isUnionOrIntersection()) {
        if (node && this.isPropsUnion(type, node)) {
          // special case
        } else {
          let t = 0;
          for (const member of type.types) {
            if (!this.checkNode(node, member, `${scope}.[${t}]`)) {
              childFailure = true;
            }
            ++t;
          }
        }
      } else if (base === "Uint8Array") {
        // special case
      } else {
        const properties = type.getProperties();

        for (const member of properties) {
          if (this.isFunction(member)) {
            failure = true;
            message += `\n"${scope || base}.${member.name}" is a function.`;
          } else if (node) {
            const memberType = this._checker.getTypeOfSymbolAtLocation(member, node);

            if (!this.checkNode(node, memberType, `${scope || base}.${member.name}`)) {
              childFailure = true;
            }
          }
        }
      }
    }

    if (failure && node) {
      this._ctx.addFailureAtNode(node, message);
    }

    typeAny[LOCKED] = false;

    return !failure && !childFailure;
  }

  private isPropsUnion(type: ts.UnionOrIntersectionType, node: ts.Node) {
    let primitives = 0;
    let classes = 0;

    for (const _member of type.types) {
      const member = this.resolveReferences(_member).type;
      if (member.isClass()) {
        ++classes;
      } else if (this.isUndefinedOrNull(member)) {
        // these don't count as a primitive in this case
      } else if (this.checkNode(node, member, "")) {
        ++primitives;
      }
    }

    return classes === 1 && primitives;
  }

  private isFunction(symbol: ts.Symbol): boolean {
    const F = ts.SymbolFlags;
    return (symbol.getFlags() & (F.Function | F.Method | F.Constructor)) !== 0;
  }

  private isPrimitive(type: ts.Type): boolean {
    const F = ts.TypeFlags;
    return (type.getFlags() & (F.String | F.StringLiteral | F.Number | F.NumberLiteral | F.Boolean | F.BooleanLiteral | F.Null | F.Undefined | F.Enum | F.EnumLiteral)) !== 0;
  }

  private isUndefinedOrNull(type: ts.Type): boolean {
    const F = ts.TypeFlags;
    return (type.getFlags() & (F.Undefined | F.Null)) !== 0;
  }

  private isRpcInterface(node: ts.ClassLikeDeclaration): boolean {
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const expr of clause.types) {
            const type = this._checker.getTypeFromTypeNode(expr);
            if (type.symbol && type.symbol.getName() === "RpcInterface") {
              return true;
            }
          }
        }
      }
    }

    return false;
  }
}
