import { NodePath } from "@babel/traverse";
import { ExecutionPoint } from "@replayio/protocol";
import { groupBy } from "lodash";

import { assert } from "../util/assert";
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
   * Steps of
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
  iterations?: CFGIteration[];

  // TODO: Add condition information.
  // condition?: TODO;
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
   * Compute a partial dynamic control flow graph (CFG), for the function, centered
   * around `this.point`.
   * It is projected onto the source code, which means that there
   * is max one step per source location.
   */
  async computeProjectedFunctionCFG(): Promise<CFGBlock> {
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
    const stepBlockParentStarts = frameSteps.map(step => ({
      step,
      // The last containing BlockParent is also the innermost.
      innerMostBlockIndex: staticBlockParents.findLast(
        block =>
          block.node!.loc!.start.index <= step.index && block.node!.loc!.end.index >= step.index
      )?.node!.loc!.start.index,
    }));
    const blocksByIndex = groupBy(staticBlockParents, block => block.node!.loc!.start.index);
    const blockGroupByStepPoint = groupBy(stepBlockParentStarts, s => s.step.point);
    const stepsByBlockStartIndex = (() => {
      const groups = groupBy(stepBlockParentStarts, "innerMostBlockIndex");
      return Object.fromEntries(
        Object.entries(groups).map(([key, values]) => [
          key,
          values.map(v => ({
            step: v.step,
            // The step that is called most often shall be our iteration divider.
            mostRepeatedIndex: 
          })),
        ])
      );
    })();

    // 2. Group steps and BlockParents into iterations.
    let stack: CFGBlock[] = [];
    for (let i = 0; i < frameSteps.length; ++i) {
      const step = frameSteps[i];
      const newBlockIndex = blockGroupByStepPoint[step.point][0].innerMostBlockIndex!;
      const newStaticBlock = blocksByIndex[newBlockIndex][0]!;
      const allStepsOfBlock = stepsByBlockStartIndex[newBlockIndex].map(g => g.step);

      // TODO: Get the first step that is called most often to skip initializer steps.
      const loopEntryStepOfBlock = TODO; // allStepsOfBlock[0].index;
      const currentBlock = stack.length ? stack[stack.length - 1] : null;

      let newBlock: CFGBlock | null = null;
      if (newStaticBlock === currentBlock?.staticBlock) {
        // Same block: Add step to current iteration.
        const blockForStep = currentBlock!;
        let currentIteration: CFGIteration;
        if (!blockForStep.iterations?.length) {
          // First step of block.
          currentIteration = { steps: [] };
          (blockForStep.iterations ||= []).push(currentIteration);
        } else {
          // TODO: Determine if this is the first iteration.
          // TODO: Put the initializer steps in the first iteration,
          //      but use `loopEntryStepOfBlock` to determine repetition.
          TODO;
          // Not the first step of block.
          currentIteration = blockForStep.iterations[blockForStep.iterations.length - 1];
          if (step.index === loopEntryStepOfBlock && TODO) {
            // Assume that the (statically) first step gets executed in every iteration.
            // If we see it again, we are in a new iteration.
            currentIteration = { steps: [] };
            blockForStep.iterations.push(currentIteration);
          }
        }
        currentIteration.steps.push(step);
      } else {
        // New block contains new step.
        const isStepOutOfNestedBlock =
          currentBlock &&
          currentBlock.blockIndex > newStaticBlock.node!.start! &&
          currentBlock.blockIndex < newStaticBlock.node!.end!;
        if (!isStepOutOfNestedBlock) {
          // Create new block if we are not stepping out into an existing block.
          newBlock = {
            parent: currentBlock,
            staticBlock: newStaticBlock,
            blockIndex: newBlockIndex,
            iterations: [{ steps: [step] }],
          };
        }
        if (!currentBlock) {
          // Root node.
          stack.push(newBlock!);
        } else {
          // Step through the CFG:
          // 1. Step into nested block.
          // 2. Step out of nested block.
          // 3. Step into sibling block.
          const isStepIntoNestedBlock =
            newBlockIndex > currentBlock.staticBlock.node!.start! &&
            newBlockIndex < currentBlock.staticBlock.node!.end!;

          // const isStepIntoSiblingBlock = !isStepIntoNestedBlock && !isStepOutOfNestedBlock;
          // The parent block whose iterations contains the new block.
          let parentBlockGroup: CFGBlock;
          if (isStepIntoNestedBlock) {
            // 1. Step in.
            parentBlockGroup = currentBlock;
          } else if (isStepOutOfNestedBlock) {
            // 2. Step out.
            do {
              stack.pop();
            } while (stack.length && stack[stack.length - 1].blockIndex !== newBlockIndex);
            assert(stack.length, "Stack was empty upon CFG step out.");
            parentBlockGroup = stack[stack.length - 1];
          } else {
            // 3. Step sideways.
            stack.pop();
            assert(stack.length, "Stack was empty upon CFG step out.");
            parentBlockGroup = stack[stack.length - 1];
          }

          const iterations = (parentBlockGroup.iterations ||= []);
          let iteration = iterations.length ? iterations[iterations.length - 1] : null;
          if (!iteration) {
            iteration = { steps: [] };
            iterations.push(iteration);
          }
          if (newBlock) {
            stack.push(newBlock);
            iteration.steps.push(newBlock);
          }
        }
      }
    }
    assert(stack.length, "Stack was empty upon CFG completion.");
    return stack[0]!;
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
//     // TODO: stub our

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
