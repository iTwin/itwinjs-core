// ====================================================================================================================
/**
 * This rule enforces that no public properties, methods, or accessors can be prefixed with an underscore.
 */
// ====================================================================================================================
import * as ts from "typescript";
import * as Lint from "tslint";

export class Rule extends Lint.Rules.AbstractRule {
  public static FAILURE_STRING: string = "Public properties, methods, and accessors cannot begin with an underscore.";

  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(
      new NoPublicUnderscoresWalker(sourceFile, this.getOptions()),
    );
  }
}

class NoPublicUnderscoresWalker extends Lint.RuleWalker {
  // override
  public visitPropertyDeclaration(node: ts.PropertyDeclaration) {
    if (!this.isPublic(node))
      return;

    const name = node.name.getText();
    if (name[0] === "_")
      this.addFailureAtNode(node, Rule.FAILURE_STRING);
  }

  // override
  public visitMethodDeclaration(node: ts.MethodDeclaration) {
    if (!this.isPublic(node))
      return;

    const name = node.name.getText();
    if (name[0] === "_")
      this.addFailureAtNode(node, Rule.FAILURE_STRING);
  }

  // override
  public visitGetAccessor(node: ts.GetAccessorDeclaration) {
    if (!this.isPublic(node))
      return;

    const name = node.name.getText();
    if (name[0] === "_")
      this.addFailureAtNode(node, Rule.FAILURE_STRING);
  }

  private isPublic(node: ts.PropertyDeclaration | ts.MethodDeclaration | ts.GetAccessorDeclaration) {
    if (node.modifiers === undefined)
      return true;  // assume no modifiers means public by default
    for (const modifier of node.modifiers) {
      const modText = modifier.getText();
      if (modText === "public")
        return true;
    }
    return false;
  }
}
