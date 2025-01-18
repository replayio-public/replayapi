import { NodePath } from "@babel/traverse";
import { ExecutionPoint } from "@replayio/protocol";
import { annotateLine } from "@replayio/source-parser/src/annotations";
import { isBabelLocContained } from "@replayio/source-parser/src/babel/babelLocations";
import { truncateAround } from "@replayio/source-parser/src/util/truncateCenter";
import { groupBy, minBy, sortBy } from "lodash";

import { assert } from "../util/assert";
import { groupByUnique } from "../util/groupByUnique";
import PointQueries from "./PointQueries";
import ReplaySession from "./ReplaySession";
import { FrameStep } from "./types";

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
   * NOTE1: This is undefined if this is not a loop block.
   * NOTE2: The firstRepeatedStep of a DoWhile loop might belong to a nested block.
   */
  firstRepeatedStep?: FrameStep;
  // TODO: Add decision step information.
  // decisionStep?: TODO;

  iterations?: CFGIteration[];
};

export interface CFGRenderOptions {
  /**
   * Max number of lines to render in each direction.
   */
  windowHalfSize?: number;
  maxLineLength?: number;
  /**
   * Whether to annotate any points but the input point.
   */
  annotateOtherPoints?: boolean;
  /**
   * When rendering the summarized code, we add block comments at point
   * locations that are prefixed by this string.
   */
  annotationLabelPrefix?: string;
}

export interface CFGRenderOutput {
  annotatedCode: string;
  steps: FrameStep[];
}

/** ###########################################################################
 * Default render config.
 * ##########################################################################*/

const DefaultRenderOptions: Required<CFGRenderOptions> = {
  windowHalfSize: 20,
  maxLineLength: 100,
  annotateOtherPoints: true,
  annotationLabelPrefix: "POINT",
};

/** ###########################################################################
 * {@link DynamicCFGBuilder}
 * ##########################################################################*/

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
    const frameSteps = (await this.pointQueries.getFrameSteps())!;

    // 0. Get all BlockParents in the frame's function.
    const functionStaticBlock = parser.babelParser!.getInnermostNodePathAt(
      thisLocation,
      "Function"
    );
    assert(functionStaticBlock, "Function not found at point.");
    const staticBlockParents =
      parser.babelParser!.getAllBlockParentsWithinFunction(functionStaticBlock);
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
    const blockParentIndexSet = new Set(staticBlockParents.map(b => b.node!.start!));

    // 2. Group steps and BlockParents into CFGBlock and CFGIterations.
    let stack: CFGBlock[] = [];
    for (let i = 0; i < frameSteps.length; ++i) {
      const step = frameSteps[i];
      const newStaticBlock = blocksByPoint[step.point]!;
      const newBlockIndex = newStaticBlock.node!.start!;
      const currentBlock = stack.length ? stack[stack.length - 1] : null;
      assert(currentBlock || i === 0, `Stack is empty when not at first step.`);

      let newBlock: CFGBlock | null = null;
      if (newStaticBlock === currentBlock?.staticBlock) {
        // Same block:
        //   → Add iteration.
        this.addIterationForStep(step, currentBlock)
          // → Add step to new iteration.
          .steps.push(step);
      } else {
        // Not the same block.
        const isStepOutOfNestedBlock =
          currentBlock &&
          currentBlock.blockIndex > newBlockIndex &&
          currentBlock.blockIndex < newStaticBlock.node!.end!;
        const newBlocks: CFGBlock[] = [];
        if (!isStepOutOfNestedBlock) {
          // We are in a new block (because we are not stepping out into an existing block).

          let lastAddedBlock: CFGBlock | null = null;
          const missingBlocks = newStaticBlock.getAncestry().filter(block => {
            if (!blockParentIndexSet.has(block.node!.start!)) {
              // Ignore unrelated blocks.
              return false;
            }
            const blockIndex = block.node!.start!;
            const isWedged = !currentBlock
              ? // Block is the root block itself, so it needs to be added.
                blockIndex == functionStaticBlock.node!.start!
              : // `block` is ancestor of newly entered block.
                blockIndex < newBlockIndex &&
                // `block` is descendant of currentBlock (which was on stack).
                blockIndex > currentBlock.blockIndex;
            return isWedged;
          });
          // Recursively add blocks wedged between what is on stack and the new block.

          missingBlocks
            // Sort blocks in ascending (increasing nested) order.
            .sort((a, b) => a.node!.start! - b.node!.start!)
            .forEach(block => {
              const blockIndex = block.node!.start!;
              // Add wedged block to stack and previous block's iteration.
              assert(
                // The first step of a nested block scenario should only happen to DoWhile and non-loops.
                block.isDoWhileStatement() || !block.isLoop(),
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                `DynamicCFGBuilder: First step of a (not DoWhile-) loop block is nested inside another block: ${block.parentPath!.toString()}`
              );
              const newBlock: CFGBlock = {
                parent: lastAddedBlock || currentBlock,
                staticBlock: block,
                blockIndex,
                firstRepeatedStep: block.isLoop() ? step : undefined,
                iterations: [{ steps: [] }],
              };
              newBlocks.push(newBlock);
              lastAddedBlock?.iterations![0].steps.push(newBlock);
              lastAddedBlock = newBlock;
            });

          // Add new block.
          const firstRepeatedStep = this.getFirstRepeatedStepAt(frameSteps, i, blocksByPoint);
          let newSteps: FrameStep[] = [];
          if (lastAddedBlock) {
            newSteps = [lastAddedBlock];
            (lastAddedBlock as CFGBlock).iterations![0].steps.push(step);
          } else {
            newSteps = [step];
          }
          newBlock = {
            parent: currentBlock,
            staticBlock: newStaticBlock,
            blockIndex: newBlockIndex,
            firstRepeatedStep,
            iterations: [{ steps: newSteps }],
          };
          newBlocks.push(newBlock);
        }
        if (!currentBlock) {
          // Root node.
          stack.push(...newBlocks);
        } else {
          const isStepIntoNestedBlock =
            newBlockIndex > currentBlock.staticBlock.node!.start! &&
            newBlockIndex < currentBlock.staticBlock.node!.end!;

          // The block whose iterations contains the new block or the step.
          let parentBlock: CFGBlock;

          // Three types of CFG block transitions:
          // 1. Step into nested block. (Creates new block.)
          // 2. Step out of nested block. (Does not create new block.)
          // 3. Step to sibling block. (Creates new block.)
          if (isStepIntoNestedBlock) {
            // 1. Step in.
            parentBlock = currentBlock;
          } else if (isStepOutOfNestedBlock) {
            // 2. Step out.
            const oldStack = [...stack];
            do {
              stack.pop();
            } while (stack.length && stack[stack.length - 1].blockIndex !== newBlockIndex);
            if (!stack.length) {
              throw new Error(
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                `Stack was empty (had ${oldStack.length}) upon CFG step out at: ${newStaticBlock.toString()}`
              );
            }
            parentBlock = stack[stack.length - 1];
          } else {
            // 3. Step sideways.
            stack.pop();
            if (!stack.length) {
              throw new Error(
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                `Stack was empty upon CFG step to sibling at: ${newStaticBlock.toString()}`
              );
            }
            parentBlock = stack[stack.length - 1];
          }

          const currentIteration = this.addIterationForStep(step, parentBlock);
          if (newBlock) {
            stack.push(...newBlocks);
            currentIteration.steps.push(newBlock);
          } else {
            currentIteration.steps.push(step);
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
  private addIterationForStep(step: FrameStep, blockForStep: CFGBlock) {
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

    if (baseBlock.isDoWhileStatement()) {
      // The first step of a DoWhile loop is also its firstRepeatedStep.
      return baseStep;
    }

    if (!baseBlock.isLoop()) {
      return undefined;
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
        // Ignore nested loops.
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

  renderLine(line: string, step: FrameStep, renderOptions: Required<CFGRenderOptions>): string {
    const {
      maxLineLength,
      annotateOtherPoints,
      annotationLabelPrefix: StepAnnotationLabelPrefix,
    } = renderOptions;
    let annotation: string | undefined;
    const { point } = this;
    if (step.point === point || annotateOtherPoints) {
      annotation = `${StepAnnotationLabelPrefix}:${step.point}`;
    }
    if (maxLineLength && line.length > maxLineLength) {
      line = truncateAround(line, step.column, maxLineLength);
    }
    if (annotation) {
      line = annotateLine(line, annotation, step.column);
    }
    return line;
  }

  /**
   * Render the in-frame code around `this.point`, focusing on and annotating steps within
   * all cascading scopes of `this.point`.
   * NOTE: This currently only works well for short lines.
   * TODO: In case of minified code, we need to work against AST nodes rather than lines.
   */
  async renderCode(_renderOptions?: CFGRenderOptions): Promise<CFGRenderOutput> {
    const renderOptions = { ...DefaultRenderOptions, ..._renderOptions };
    const { windowHalfSize } = renderOptions;

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

    // 0. Create a step for `point`, in case it does not exist.
    const stepAtPoint = {
      point,
      ...thisLocation,
      index: parser.code.locationToIndex(thisLocation),
    };

    // 1. Build CFG.
    const graph = await this.buildProjectedFrameCFG();

    // 2. Get all executed lines within all current scopes.
    const blockAtPoint = CFGQueries.getBlock(graph, point);
    if (!blockAtPoint) {
      const graph = await this.buildProjectedFrameCFG();
      const blockAtPoint = CFGQueries.getBlock(graph, point);
      throw new Error(`No block found for point ${point}`);
    }

    // 3. Select maxRenderLines in each direction.
    const functionLine = functionInfo.lines.start;
    const windowMinLine = Math.max(functionInfo.lines.start, thisLocation.line - windowHalfSize);
    const windowMaxLine = Math.min(functionInfo.lines.end, thisLocation.line + windowHalfSize);
    const windowStart = windowMinLine - functionLine;
    const windowEnd = windowMaxLine - functionLine;

    // 4. Get the source code.
    const functionCodeLines = parser.getInnermostFunction(thisLocation)!.text.split("\n");
    const codeWindow = functionCodeLines.slice(windowStart, windowEnd + 1);

    // 5. Use in-scope frames to annotate the lines.
    const uniqueLineSteps = sortBy(
      CFGQueries.getUniqueExecutedLineStepsInScope(graph, stepAtPoint),
      s => s.line
    );
    const stepsByLineIndex = groupByUnique(uniqueLineSteps, s => s.line - functionLine);
    const stepsInWindow: FrameStep[] = [];
    const annotatedWindow = codeWindow.map((line, i) => {
      const step = stepsByLineIndex[i + windowStart];
      if (step) {
        stepsInWindow.push(step);
        line = this.renderLine(line, step, renderOptions);
      }
      return line;
    });

    if (windowHalfSize > 0) {
      // 6. If the earliest stepped line isn't the very first line, add the first step in that direction that is.
      const firstStep = stepsInWindow[0];
      const lastStep = stepsInWindow[stepsInWindow.length - 1];
      const firstStepIndex = firstStep!.line - windowMinLine;
      const lastStepIndex = lastStep!.line - windowMinLine;

      const minStepWindowEdgeDistance = 2; // Look for this many lines.

      if (firstStepIndex >= minStepWindowEdgeDistance) {
        // Add step at the beginning.
        const newStep = uniqueLineSteps.findLast(s => s.line < windowMinLine);
        if (newStep) {
          const line = functionCodeLines[newStep.line - functionLine];
          assert(
            line,
            `Line not found for step at line ${newStep.line} (functionLine=${functionLine}, functionCodeLines=${functionCodeLines.length})`
          );
          const newLine = this.renderLine(line, newStep, renderOptions);
          annotatedWindow.splice(
            0,
            minStepWindowEdgeDistance,
            newLine,
            '// <OmittedCode reason="NotExecuted"/>'
          );
          stepsInWindow.unshift(newStep);
        }
      }
      if (lastStepIndex < annotatedWindow.length - minStepWindowEdgeDistance) {
        // Add step at the end.
        const newStep = uniqueLineSteps.find(s => s.line > windowMaxLine);
        if (newStep) {
          const line = functionCodeLines[newStep.line - functionLine];
          annotatedWindow.splice(
            annotatedWindow.length - 1 - minStepWindowEdgeDistance,
            minStepWindowEdgeDistance,
            '// <OmittedCode reason="NotExecuted"/>',
            line
          );
          stepsInWindow.push(newStep);
        }
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
  getUniqueExecutedLineStepsInScope(graph: ControlFlowGraph, stepAtPoint: FrameStep): FrameStep[] {
    const { point } = stepAtPoint;

    // 1. Gather the set of blocks in all scopes of the given block's points.
    const block = CFGQueries.getBlock(graph, point);
    assert(block, "Block not found for point.");

    const parents = CFGQueries.getParentBlocks(block);
    const children = CFGQueries.getChildBlocks(block);
    const ownScopeBlocks = [block, ...parents, ...children];

    // 2. Collect all line numbers from these blocks' frame steps
    const steps: FrameStep[] = [];
    function collectSteps(b: CFGBlock) {
      if (!b.iterations) return;

      for (const iteration of b.iterations) {
        for (const step of iteration.steps) {
          if (!isCFGBlock(step)) {
            // Add FrameStep leaf.
            steps.push(step);
          } else {
            // Recurse into CFGBlock.
            collectSteps(step);
          }
        }
      }
    }
    for (const b of ownScopeBlocks) {
      collectSteps(b);
    }

    const stepsByLines = groupBy(steps, s => s.line);

    // 3. Make sure the input point always gets selected.
    //    This is necessary because it might not be in frame steps.
    //    E.g. it might be a bookmark.
    stepsByLines[stepAtPoint.line] ||= [];
    stepsByLines[stepAtPoint.line].push(stepAtPoint);

    // 4. Deduplicate by line.
    return Object.values(stepsByLines).map(
      // Pick the step with the closest point to the given point.
      steps => minBy(steps, s => pointDistance(s.point, point))!
    );
  },
};
