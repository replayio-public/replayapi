import assert from "assert";

import { SyntaxNode } from "tree-sitter";

import SourceParser from "../SourceParser";
import StaticScope from "./StaticScope";
import type { Declaration } from "./StaticScope";

export class ScopeMap extends Map<SyntaxNode, StaticScope> {}

export default class StaticBindings {
  public readonly scopes: ScopeMap;
  private _rootScope: StaticScope | null = null;
  constructor(public readonly parser: SourceParser) {
    this.scopes = new ScopeMap();
  }

  get rootScope(): StaticScope {
    assert(this._rootScope, "rootScope is not initialized. Call parse first.");
    return this._rootScope!;
  }

  private getOrCreateScope(node: SyntaxNode) {
    let scope = this.scopes.get(node);
    if (!scope) {
      const declarations = new Map<string, Declaration>();
      scope = new StaticScope(this, node, declarations, []);
      this.scopes.set(node, scope);
    }
    return scope;
  }

  private hasOwnScope(node: SyntaxNode) {
    return this.parser.language.scopeOwner.has(node.type);
  }

  _parse(): void {
    function addNamedDeclaration(
      scope: StaticScope,
      declarationNode: SyntaxNode,
      nameNode: SyntaxNode
    ) {
      const name = nameNode.text;
      scope.declarations.set(name, { name, declarationNode, nameNode });
    }

    /**
     * Types, Interfaces, Functions, Classes etc. all have a `name` field.
     * Some of them might or might not have bodies.
     * If name has multiple definitions, prefer an overload with body.
     */
    function maybeAddNamedMaybeWithBody(scope: StaticScope, declarationNode: SyntaxNode) {
      const nameNode = declarationNode.childForFieldName("name");
      const name = nameNode?.text;
      if (!name) {
        return;
      }
      const lastDeclaration = scope.declarations.get(name);
      // Check for overload groups: Pick implementation, or first forward declaration otherwise.
      if (
        lastDeclaration &&
        declarationNode.parent?.id === lastDeclaration.declarationNode.parent?.id &&
        declarationNode.type === lastDeclaration.declarationNode.type
      ) {
        // Prefer implementation over forward declaration.
        const hasBody = declarationNode.childForFieldName("body");
        const lastHasBody = lastDeclaration.declarationNode.childForFieldName("body");
        if (!hasBody && lastHasBody) {
          return;
        }
      }

      addNamedDeclaration(scope, declarationNode, nameNode);
    }

    /**
     * Variable declarators and parameters, e.g.:
     * const a = 1;
     * let { b, c } = obj;
     * function (a, [b, { c: cc, d }], ...moreArgs) {}
     * import a, { b, c as cc } from "module";
     * ...and more...
     */
    function addIdentifierDescendants(scope: StaticScope, node: SyntaxNode): void {
      // All pattern node names are `identifier` or `shorthand_property_identifier_pattern`.
      const nameNodes = node.descendantsOfType([
        "identifier",
        "shorthand_property_identifier_pattern",
      ]);
      for (const nameNode of nameNodes) {
        const aliasNode = nameNode.parent!.childForFieldName("alias");
        // `alias` is only used in the `as` node of import and export statements.
        addNamedDeclaration(scope, node, aliasNode || nameNode);
      }
    }

    const visit = (node: SyntaxNode, scope: StaticScope): StaticScope => {
      // Parse nodes.
      switch (node.type) {
        case "formal_parameters":
        case "variable_declarator":
        case "import_clause":
          addIdentifierDescendants(scope, node);
          break;

        // TODO: Handle declarations not directly owned by scopes.
        // case "getter_declaration":
        // case "setter_declaration":
        // case "property_definition":
        // case "property_signature":
        // case "enum_member":
        //   addNamedDeclaration(node);
        //   break;

        // TODO: Inter-module stuff.
        // case "module_declaration":
        // case "export_statement":
        // case "export_clause":
        //   break;

        default:
          // Handle most named nodes.
          maybeAddNamedMaybeWithBody(scope, node);
          break;
      }

      // Initialize new scope.
      scope = this.hasOwnScope(node) ? this.getOrCreateScope(node) : scope;

      // Recursively visit children
      node.children.forEach(n => visit(n, scope));
      return scope;
    };

    this._rootScope = visit(
      this.parser.tree.rootNode,
      this.getOrCreateScope(this.parser.tree.rootNode)
    );
  }
}
