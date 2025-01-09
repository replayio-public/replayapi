import { Expression as BabelExpression, Statement as BabelStatement } from "@babel/types";

export type BasicNode = BabelStatement | BigBasicBlock;

/**
 * We don't care about all basic blocks, only those that require summarization.
 */
export interface BigBasicBlock {
  children: BasicNode[];
}

export interface IfBlock extends BigBasicBlock {
  condition: BabelExpression;
  trueBlock: BigBasicBlock;
  falseBlock: BigBasicBlock;
}

/**
 * Simple partial code graph representation that we use in combination with dynamic analysis
 * to summarize the code using dynamic paging, block summarization and more.
 */
export class StaticPartialCodeGraph {
  // constructor(public readonly parser: SourceParser) {
  // }
  // build(ast: BabelNode): Map<string, BigBasicBlock> {
  //   traverse(ast, {
  //     enter: path => {
  //       if (this.isBranchNode(path.node)) {
  //         const condition = this.extractCondition(path.node);
  //         const trueBlock = this.createBlock();
  //         const falseBlock = this.createBlock();
  //         this.currentBlock.setCondition(condition);
  //         this.currentBlock.setBranches(trueBlock, falseBlock);
  //         this.currentBlock = trueBlock;
  //       } else if (t.isStatement(path.node)) {
  //         this.currentBlock.addStatement(path.node);
  //       }
  //     },
  //   });
  //   return this.blocks;
  // }
  // private isBranchNode(node: BabelNode): boolean {
  //   return (
  //     // basic blocks with expression condition
  //     t.isIfStatement(node) ||
  //     // Just add these as-is.
  //     t.isConditionalExpression(node) ||
  //     t.isLogicalExpression(node) ||
  //     //  basic block with pattern matching
  //     t.isSwitchStatement(node) ||
  //     //  loops
  //     t.isLoop(node) ||
  //     // basic blocks without conditions
  //     t.isTryStatement(node) ||
  //     t.isCatchClause(node)
  //   );
  // }
}
