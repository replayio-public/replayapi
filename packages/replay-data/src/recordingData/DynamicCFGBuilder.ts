import { NodePath } from "@babel/traverse";
import { ExecutionPoint } from "@replayio/protocol";
import { isBabelLocContained } from "@replayio/source-parser/src/babel/babelLocations";

import { assert } from "../util/assert";
import { groupByUnique } from "../util/groupByUnique";
import PointQueries from "./PointQueries";
import ReplaySession from "./ReplaySession";
import { FrameStep } from "./types";

/** ###########################################################################
 * Render config.
 * ##########################################################################*/

/**
 * Max number of lines to render in each direction.
 */
const MaxRenderLines = 20;

/**
 * When rendering the summarized code, we add block comments at point
 * locations that are prefixed by this string.
 */
const StepAnnotationLabelPrefix = "POINT";

/** ###########################################################################
 * {@link DynamicCFGBuilder}
 * ##########################################################################*/

/**
 * Represents one iteration of a block.
 */
export type CFGIteration = {
  /**
   * Steps of one iteration.
   */
  steps: (FrameStep | CFGBlock)[];
};

/**
 * All frame steps and children of a BlockParent, grouped by iteration.
 * TODO: Make sure this covers all basic blocks.
 */
export type CFGBlock = {
  parent: CFGBlock | null;
  staticBlock: NodePath;
  /** Start index in source code. */
  blockIndex: number;
  /**
   * Index of the first step in the iteration that is repeated.
   * This is undefined in 2 cases:
   * * Block is not a loop.
   * * Block is a DoWhile loop that was executed once.
   */
  firstRepeatedStep?: FrameStep;
  // TODO: Add decision step information.
  // decisionStep?: TODO;

  iterations?: CFGIteration[];
};

export default class DynamicCFGBuilder {
  // uniqBy(steps.slice(0, idx).reverse(), s => s.)
  constructor(public readonly pointQueries: PointQueries) {}

  get point(): ExecutionPoint {
    return this.pointQueries.point;
  }
  get session(): ReplaySession {
    return this.pointQueries.session;
  }

  /**
   * Compute a partial dynamic control flow graph (CFG), for the frame, centered
   * around `this.point`.
   * It is projected onto the source code, which means that there
   * is max one step per source location.
   */
  async buildProjectedFrameCFG(): Promise<CFGBlock> {
    const [thisLocation, parser] = await Promise.all([
      this.pointQueries.getSourceLocation(),
      this.pointQueries.parseSource(),
    ]);
    const frameSteps = (await this.pointQueries.getFrameSteps())!;

    // const { point } = this.pointQueries;
    // const idx = steps.findIndex(step => step.point === point);

    // 0. Get all BlockParents within the function that contains the point.
    //    NOTE: This is simplifying things, as we are not adding non-block CFG nodes
    //          (but their execution or non-execution is visible in this CFG).
    const staticBlockParents = parser.babelParser!.getAllBlockParentsInFunctionAt(thisLocation);
    assert(staticBlockParents.length, "No block parents found in function.");

    // 1. Group all steps by their inner most BlockParent's start index.
    const stepBlocks = frameSteps.map(step => ({
      step,
      // The "own" block is the innermost block, aka the last seen BlockParent that contains the step.
      ownBlock: staticBlockParents.findLast(b => isBabelLocContained(step.index, b.node!))!,
    }));
    const blocksByPoint = groupByUnique(
      stepBlocks,
      s => s.step.point,
      s => s.ownBlock
    );
    // const stepsByBlockStartIndex = (() => {
    //   const groups = groupBy(stepBlockParentStarts, "ownBlockIndex");
    //   return Object.fromEntries(
    //     Object.entries(groups).map(([ownBlockIndex, steps]) => {
    //       return [
    //         ownBlockIndex,
    //         steps.map(v => ({
    //           step: v.step,
    //         })),
    //       ];
    //     })
    //   );
    // })();

    // 2. Group steps and BlockParents into iterations.
    let stack: CFGBlock[] = [];
    for (let i = 0; i < frameSteps.length; ++i) {
      const step = frameSteps[i];
      const newStaticBlock = blocksByPoint[step.point]!;
      const newBlockIndex = newStaticBlock.node!.start!;
      const currentBlock = stack.length ? stack[stack.length - 1] : null;

      let newBlock: CFGBlock | null = null;
      if (newStaticBlock === currentBlock?.staticBlock) {
        // Add step to same block.
        // TODO: Handle the case where the repeated step is inside a nested block inside a DoWhileStatement:
        //    → Need to add Iteration objects to parent blocks as well.
        this.addIterationStep(step, currentBlock);
      } else {
        // Not the same block.
        const isStepOutOfNestedBlock =
          currentBlock &&
          currentBlock.blockIndex > newStaticBlock.node!.start! &&
          currentBlock.blockIndex < newStaticBlock.node!.end!;
        if (!isStepOutOfNestedBlock) {
          // We are in a new block (because we are not stepping out into an existing block).
          const firstRepeatedStep = this.getFirstRepeatedStepAt(frameSteps, i, blocksByPoint);
          newBlock = {
            parent: currentBlock,
            staticBlock: newStaticBlock,
            blockIndex: newBlockIndex,
            firstRepeatedStep,
            iterations: [{ steps: [step] }],
          };
        }
        if (!currentBlock) {
          // Root node.
          stack.push(newBlock!);
        } else {
          const isStepIntoNestedBlock =
            newBlockIndex > currentBlock.staticBlock.node!.start! &&
            newBlockIndex < currentBlock.staticBlock.node!.end!;

          // The block whose iterations contains the new block and the step.
          let blockForStep: CFGBlock;

          // Three types of CFG block transitions:
          // 1. Step into nested block. (Creates new block.)
          // 2. Step into sibling block. (Creates new block.)
          // 3. Step out of nested block. (Does not create new block.)
          if (isStepIntoNestedBlock) {
            // 1. Step in.
            blockForStep = currentBlock;
          } else if (isStepOutOfNestedBlock) {
            // 2. Step out.
            do {
              stack.pop();
            } while (stack.length && stack[stack.length - 1].blockIndex !== newBlockIndex);
            assert(stack.length, "Stack was empty upon CFG step out.");
            blockForStep = stack[stack.length - 1];
          } else {
            // 3. Step sideways.
            stack.pop();
            assert(stack.length, "Stack was empty upon CFG step out.");
            blockForStep = stack[stack.length - 1];
          }

          const currentIteration = this.addIterationStep(step, blockForStep);
          if (newBlock) {
            stack.push(newBlock);
            currentIteration.steps.push(newBlock);
          }
        }
      }
    }
    assert(stack.length, "Stack was empty upon CFG completion.");
    return stack[0]!;
  }

  /**
   * 1. Add iteration if this step is the first or the first repeated step.
   * 2. Add step to that iteration.
   */
  private addIterationStep(step: FrameStep, blockForStep: CFGBlock) {
    let currentIteration: CFGIteration;
    if (!blockForStep.iterations?.length) {
      // First step of block.
      currentIteration = { steps: [] };
      (blockForStep.iterations ||= []).push(currentIteration);
    } else {
      // Not the first step of block.
      currentIteration = blockForStep.iterations[blockForStep.iterations.length - 1];

      // Check if we are re-entering.
      // NOTE: We put initializer steps into the first iteration.
      const isNewIteration =
        blockForStep.firstRepeatedStep &&
        step.index === blockForStep.firstRepeatedStep.index &&
        step.point !== blockForStep.firstRepeatedStep.point;

      if (isNewIteration) {
        currentIteration = { steps: [] };
        blockForStep.iterations.push(currentIteration);
      }
    }
    currentIteration.steps.push(step);
    return currentIteration;
  }

  /** ###########################################################################
   * Utilities.
   * ##########################################################################*/

  /**
   * Get the first step that is repeated.
   */
  getFirstRepeatedStepAt(
    steps: FrameStep[],
    i: number,
    blocksByPoint: Record<string, NodePath>
  ): FrameStep | undefined {
    const baseStep = steps[i];
    const baseBlock = blocksByPoint[baseStep.point]!;

    // DoWhile: Always the first step.
    if (baseBlock.isDoWhileStatement()) {
      return steps[i];
    }

    // Find the first repeated step by looking ahead in the frameSteps of the loop's current dynamic block execution.
    const seenIndexes = new Map<number, FrameStep>([[baseStep.index, baseStep]]);
    for (i += 1; i < steps.length; ++i) {
      const step = steps[i];
      const block = blocksByPoint[step.point]!;
      if (!isBabelLocContained(step.index, baseBlock.node!)) {
        // Stepped out of block.
        return undefined;
      }
      if (block !== baseBlock) {
        // Ignore nested blocks.
        continue;
      }

      // Find first repeated step.
      const seenStep = seenIndexes.get(step.index);
      if (seenStep) {
        return seenStep;
      }
      seenIndexes.set(step.index, step);
    }
    return undefined;
  }
}

//   /**
//    * Lines of blocks that had no steps.
//    */
//   async replaceUnsteppedBlocksInRange(startLine: number, labeledCode: string[]): Promise<void> {
//     const [parser] = await Promise.all([this.pointQueries.parseSource()]);
//     // const functionInfo = (await this.pointQueries.queryFunctionInfo())!;
//     // const
//     // StepAnnotationLabelPrefix
//   }

//   /**
//    * Render a summarized version of the code graph:
//    * 1. Render up to `maxLines` in both directions from startLoc with  frame steps annotated as block comments.
//    * 2. Try to render entire basic blocks (even statements without hits), but omit parts if they exceed max length.
//    * 3. Omit multi-statement basic blocks that were not taken.
//    * 4a. Loops: Always render each line only once
//    * 4b. Render a comment inside loops to indicate other iterations.
//    *
//    * NOTE: We are rendering line-by-line, rather than statement-by-statement because the
//    * straight-forward solution for the latter would require code modifications with babel,
//    * which would produce output code different from the input code.
//    */
//   async render(): Promise<string> {
//     const [thisLocation, parser] = await Promise.all([
//       this.pointQueries.getSourceLocation(),
//       this.pointQueries.parseSource(),
//     ]);
//     if (!parser.babelParser) {
//       return "(TODO: unknown)";
//     }
//     const functionInfo = (await this.pointQueries.queryFunctionInfo())!;
//     const { point } = this;

//     // 1. Get BlockParents, and all their frame steps, grouped by iterations.
//     const blockParents = await this.computeCFG();

//     // 2. Select the closest iteration for each BlockParent.
//     const rangeStartLine = Math.max(functionInfo.lines.start, thisLocation.line - MaxRenderLines);
//     const rangeEndLine = Math.min(functionInfo.lines.end, thisLocation.line + MaxRenderLines);
//     const rangeStartIndex = parser.code.locationToIndex({ line: rangeStartLine, column: 0 });
//     const rangeEndIndex = parser.code.locationToIndex({ line: rangeEndLine + 1, column: 0 });
//     const blockParentsInRange = blockParents.filter(
//       bp => bp.endIndex >= rangeStartIndex && bp.startIndex <= rangeEndIndex
//     );
//     const selectedIterations = blockParents.map(block => ({
//       block,
//       iteration: minBy(block.iterations!, i =>
//         minBy(i.steps, s => BigInt(s.point) - BigInt(point))
//       ),
//     }));

//     // Get labeled lines of code from the source.
//     const labeledCode = [TODO];

//     // Stub out all ancestor node headers of the node that contains the earliest line of code.
//     // TODO: Don't stub out the function header itself.
//     const missingPreviousLines = startLine - functionInfo.lines.start;
//     const missingNextLines = functionInfo.lines.end - endLine;

//     // TODO: For every Block: Determine if it was executed at all based on their parent AST node:
//     //    IfStatement, CatchStatement, TryStatement's finally: Check which blocks have any steps.
//     //    DoWhile: Will always iterate at least once.
//     //    Other LoopStatement: Block is executed if there are any repeated steps.

//     // Add comments to inform about omissions.
//     if (missingPreviousLines) {
//       labeledCode.unshift(...TODO);
//     }
//     if (missingNextLines) {
//       labeledCode.push(...TODO);
//     }

//     // Render final code.
//     return labeledCode.join("\n");
//   }
// }
