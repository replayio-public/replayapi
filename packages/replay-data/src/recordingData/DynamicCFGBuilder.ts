import { NodePath } from "@babel/traverse";
import { ExecutionPoint } from "@replayio/protocol";
import { annotateLine } from "@replayio/source-parser/src/annotations";
import { isBabelLocContained } from "@replayio/source-parser/src/babel/babelLocations";
import { groupBy, minBy } from "lodash";

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
const DefaultWindowHalfSize = 20;

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

export type ControlFlowGraph = {
  root: CFGBlock;
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

export interface CFGRenderOutput {
  annotatedCode: string;
  steps: FrameStep[];
}

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
  async buildProjectedFrameCFG(): Promise<ControlFlowGraph> {
    const [thisLocation, parser] = await Promise.all([
      this.pointQueries.getSourceLocation(),
      this.pointQueries.parseSource(),
    ]);
    const frameSteps = (await this.pointQueries.getFrameSteps())!
      // TODO: remove this hackfix!!!
      // hackfix for 951: We don't handle stepping into multi-nested blocks yet.
      .slice(1);

    // 0. Get all BlockParents in the frame's function.
    const staticBlockParents = parser.babelParser!.getAllBlockParentsInFunctionAt(thisLocation);
    assert(staticBlockParents.length, "No block parents found in function.");

    // 1. Group all steps by their innermost BlockParent's start index.
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

    // 2. Group steps and BlockParents into CFGBlock and CFGIterations.
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
          // TODO1: Recursively add blocks for all static blocks that are not on stack yet.
          // TODO2: and add all nested blocks to parent block iterations.
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
          // 2. Step out of nested block. (Does not create new block.)
          // 3. Step to sibling block. (Creates new block.)
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
    return {
      root: stack[0]!,
    };
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

      // Check if we are re-entering by checking if we hit the location of the `firstRepeatedStep`.
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

  /**
   * Render a summarized version of the CFG.
   */
  async render(windowHalfSize = DefaultWindowHalfSize): Promise<CFGRenderOutput> {
    const [thisLocation, parser] = await Promise.all([
      this.pointQueries.getSourceLocation(),
      this.pointQueries.parseSource(),
    ]);
    if (!parser.babelParser) {
      throw new Error(`TODO: check why babel parser failed`);
    }
    const functionInfo = await this.pointQueries.queryFunctionInfo();
    assert(functionInfo, "Function info not found at point.");
    const { point } = this;

    // 1. Build CFG.
    const graph = await this.buildProjectedFrameCFG();

    // 2. Get all executed lines within all current scopes.
    const blockAtPoint = CFGQueries.getBlock(graph, point);
    if (!blockAtPoint) {
      throw new Error(`No block found for point ${point}`);
    }

    // 3. Select maxRenderLines in each direction.
    const functionLine = functionInfo.lines.start;
    const minLine = Math.max(functionInfo.lines.start, thisLocation.line - windowHalfSize);
    const maxLine = Math.min(functionInfo.lines.end, thisLocation.line + windowHalfSize);
    const windowStart = minLine - functionLine;
    const windowEnd = maxLine - functionLine;

    // 4. Use in-scope frames to annotate the lines.
    const stepsByLineIndex = groupByUnique(
      CFGQueries.getUniqueExecutedLineStepsInScope(graph, point),
      s => s.line - functionLine
    );
    const functionCodeLines = parser.getInnermostFunction(thisLocation)!.text.split("\n");
    const codeWindow = functionCodeLines.slice(windowStart, windowEnd + 1);

    const stepsInWindow: FrameStep[] = [];
    const annotatedWindow = codeWindow.map((line, i) => {
      const step = stepsByLineIndex[i + windowStart];
      if (step) {
        stepsInWindow.push(step);
        line = annotateLine(line, `${StepAnnotationLabelPrefix}:${step.point}`, step.column);
      }
      return line;
    });

    if (windowHalfSize > 0) {
      // 5. If the earliest stepped line isn't the very first line, add the first step in that direction that is.
      const firstStep = stepsInWindow[0];
      const lastStep = stepsInWindow[stepsInWindow.length - 1];
      const firstStepIndex = firstStep!.line - minLine;
      const lastStepIndex = lastStep!.line - minLine;
      const minStepWindowEdgeDistance = 2; // If lines this close to the edge don't have steps, add the next one over.

      if (firstStepIndex >= minStepWindowEdgeDistance) {
        // Add step at the beginning.
        const newStep = TODO;
        const newLine = TODO;
        annotatedWindow.splice(0, minStepWindowEdgeDistance, newLine, "...");
        stepsInWindow.unshift(newStep);
      }
      if (lastStepIndex < annotatedWindow.length - minStepWindowEdgeDistance) {
        // Add step at the end.
        const newStep = TODO;
        const newLine = TODO;
        annotatedWindow.splice(
          annotatedWindow.length - 1 - minStepWindowEdgeDistance,
          minStepWindowEdgeDistance,
          "...",
          newLine
        );
        stepsInWindow.push(newStep);
      }
    }

    // TODO: Omit code that untaken branches and other code that did not get executed; annotate correctly.

    // Render final code.
    return {
      annotatedCode: annotatedWindow.join("\n"),
      steps: stepsInWindow,
    };
  }
}

/**
 * Helper type-guard to differentiate CFGBlock vs. FrameStep in 'steps'.
 */
function isCFGBlock(step: FrameStep | CFGBlock): step is CFGBlock {
  return (step as CFGBlock).staticBlock !== undefined;
}

function pointDistance(a: ExecutionPoint, b: ExecutionPoint): number {
  return Math.abs(Number(BigInt(a) - BigInt(b)));
}

/**
 * This is just a namespace for querying `CFG*` objects.
 * NOTE: We need a better approach, as we are mixing OOP and FP.
 */
export const CFGQueries = {
  /**
   * Find the CFGBlock that contains a FrameStep closest to given ExecutionPoint.
   */
  getBlock(cfg: ControlFlowGraph, point: ExecutionPoint): CFGBlock | null {
    let closestBlock: CFGBlock | null = null;
    let minDistance = Infinity;

    function findBlock(block: CFGBlock) {
      if (!block.iterations) return;

      for (const iteration of block.iterations) {
        for (const step of iteration.steps) {
          if (!isCFGBlock(step)) {
            const distance = pointDistance(step.point, point);
            if (distance < minDistance) {
              minDistance = distance;
              closestBlock = block;
            }
          } else {
            findBlock(step);
          }
        }
      }
    }

    findBlock(cfg.root);
    return closestBlock;
  },

  /**
   * Find all parent blocks (direct and indirect) of the given block.
   */
  getParentBlocks(block: CFGBlock): CFGBlock[] {
    const parents: CFGBlock[] = [];
    let current = block.parent;
    while (current) {
      parents.push(current);
      current = current.parent;
    }
    return parents;
  },

  /**
   * Find all descendant blocks (in any iterations) of the given block.
   */
  getChildBlocks(block: CFGBlock): CFGBlock[] {
    const result: CFGBlock[] = [];

    function collectChildren(current: CFGBlock) {
      if (!current.iterations) return;

      for (const iteration of current.iterations) {
        for (const step of iteration.steps) {
          if (isCFGBlock(step)) {
            result.push(step);
            collectChildren(step);
          }
        }
      }
    }

    collectChildren(block);
    return result;
  },

  /**
   * Get an array of steps, from the given block in the block's scope.
   * That includes those of its asendants path to root and all descendants.
   * Ancestor block steps should already have unique steps.
   * For children, select the step of closest point for each unqiue line.
   */
  getUniqueExecutedLineStepsInScope(graph: ControlFlowGraph, point: ExecutionPoint): FrameStep[] {
    // 1) Gather the set of blocks in all scopes of the given block's points.
    const block = CFGQueries.getBlock(graph, point);
    assert(block, "Block not found for point.");

    const parents = CFGQueries.getParentBlocks(block);
    const children = CFGQueries.getChildBlocks(block);
    const ownScopeBlocks = [block, ...parents, ...children];

    // 2) Collect all line numbers from these blocks' frame steps
    const steps: FrameStep[] = [];

    function collectSteps(b: CFGBlock) {
      if (!b.iterations) return;

      for (const iteration of b.iterations) {
        for (const step of iteration.steps) {
          if (!isCFGBlock(step)) {
            // step is a FrameStep
            steps.push(step);
          } else {
            // step is a CFGBlock, gather lines recursively from nested blocks
            collectSteps(step);
          }
        }
      }
    }

    for (const b of ownScopeBlocks) {
      collectSteps(b);
    }

    // 3) Deduplicate by line.
    const stepsByLines = groupBy(steps, s => s.line);
    return Object.values(stepsByLines).map(
      // Pick the step with the closest point to the given point.
      steps => minBy(steps, s => pointDistance(s.point, point))!
    );
  },
};
