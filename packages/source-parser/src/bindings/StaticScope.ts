import { SyntaxNode } from "tree-sitter";

import StaticScopes from "./StaticScopes";

export interface Declaration {
  name: string;
  declarationNode: SyntaxNode;
  nameNode: SyntaxNode;
}

export type DeclarationMap = Map<string, Declaration>;

export default class StaticScope {
  constructor(
    public readonly bindings: StaticScopes,
    public readonly parent: StaticScope | null,
    public readonly node: SyntaxNode,
    public readonly declarations: DeclarationMap,
    public readonly children: StaticScope[]
  ) {}

  getOwnDeclaration(name: string): Declaration | undefined {
    return this.declarations.get(name);
  }

  /**
   * Look for first declaration in this scope or any of its descendants.
   */
  getDescendantDeclaration(name: string): Declaration | undefined {
    const declaration = this.getOwnDeclaration(name);
    if (declaration) {
      return declaration;
    }
    const descendant = this.children.find(child => child.getDescendantDeclaration(name));
    return descendant?.getOwnDeclaration(name);
  }
}
