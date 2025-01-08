import { ExecutionPoint, PointDescription, SourceLocation } from "@replayio/protocol";

import PointQueries from "./PointQueries";
import ReplaySession from "./ReplaySession";
import { NeighboringCodeSummary } from "./types";

export type FrameStep = SourceLocation & { point: ExecutionPoint };
export type UniqueFrameStep = FrameStep & { hits: number };

export class CodeSummarizer {
  private nLinesUp: number = 0;
  private nLinesDown: number = 0;
  // uniqBy(steps.slice(0, idx).reverse(), s => s.)
  private frameSteps: UniqueFrameStep[] = [];

  constructor(public readonly pointQueries: PointQueries) {}

  get point(): ExecutionPoint {
    return this.pointQueries.point;
  }
  get session(): ReplaySession {
    return this.pointQueries.session;
  }

  private async prepareFrameSteps() {
    const [allSources] = await Promise.all([this.session.getSources()]);
    this.frameSteps =
      (await this.pointQueries.getFrameSteps())
        ?.filter(s => s.frame)
        ?.map(s => ({
          point: s.point,
          ...allSources.getBestLocation(s.frame!),
          hits: 0,
        })) || [];
  }

  private async getUniqueFrameSteps(steps: FrameStep[]): Promise<UniqueFrameStep[]> {
    const [parser] = await Promise.all([this.pointQueries.parseSource()]);
    // Count unique steps by their location index
    const uniqueSteps = new Map<number, UniqueFrameStep>();
    for (const step of steps) {
      const index = parser.code.locationToIndex(step);
      let existing = uniqueSteps.get(index);
      if (existing) {
        existing.hits++;
      } else {
        uniqueSteps.set(index, (existing = { ...step, hits: 1 }));
      }
    }

    return Array.from(uniqueSteps.values());
  }

  async summarize(): Promise<NeighboringCodeSummary | undefined> {
    if (!this.frameSteps.length) {
      return undefined;
    }

    // 1. Get all steps.
    // 2. Map each step to their statement
    // 2b. Handle expression (no statements) in case of implicit-return lambdas.
    // 3a. Get neighboring statements if they have a step in the current scope.
    // 3b. Same for parent scope.
    // 3c. Child scopes: Only if executed within the current scope.
  }

  private async summarizeStepsInDirection(
    steps: PointDescription[],
    index: number,
    delta: number,
    maxStatements: number = 20,
    maxLines: number = 80
  ): Promise<SummarizedCodeAtPoint[]> {
    const maxStepCount = (delta > 0 ? steps.length - index : index) - 1;
    const code = parser.code;
    const result: SummarizedCodeAtPoint[] = [];
    let nLines = 0;
    for (let i = 1; i < maxStepCount && result.length < maxStatements && nLines < maxLines; ++i) {
      const step = steps[index + delta * i];
      if (step.frame) {
        const loc = allSources.getBestLocation(step.frame);
        const sourceOffset = code.locationToIndex(loc);
        const statementPath = parser.getStatementAt(sourceOffset);
        const statement = statementPath?.node;
        if (!statement) {
          continue;
        }
        // TODO: compare originDynamicScope and group all steps into dynamicScope(step)
        // TODO: Only get steps of the current scope, or the scope nearest to the current scope (if not in own sub-tree).
        // * if isLoopHead(statement): add nearest iteration steps, summarize other iterations
        // * else if isOtherBranchBlockHead(statement): add steps
        // * else if isInNewFunction(statement): if function is more than 2 statements, omit the indetermediates with ...
        export const BabelBranchCover = [
          "IfStatement",
          "SwitchStatement",
          "TryStatement",
          "CatchClause",
          "Loop",
          "CompletionStatement",
        ];

        // if (statement.is("BlockParent")) {
        // } else {
        //  // TODO: add statement point as-is
        // }
        nLines += statement.loc.end.line - statement.loc.start.line + 1;
      }
    }
    return result;
  }

  /**
   * Render a summarized version of the code graph:
   * 1. Render up to `maxLines` in both directions from startLoc with  frame steps annotated as block comments.
   * 2. Try to render entire basic blocks (even statements without hits), but omit parts if they exceed max length.
   * 3. Omit multi-statement basic blocks that were not taken.
   * 4a. Loops: Always render each line only once
   * 4b. Render a comment inside loops to indicate other iterations.
   *
   * @param steps All executed frame steps of frame.
   * @param maxSteps Maximum number of steps to render in each direction.
   * @param stepAnnotationLabel Optional label to render at all steps.
   */
  async render(maxSteps: number = 25, stepAnnotationLabel?: string): Promise<string> {
    const [parser] = await Promise.all([this.pointQueries.parseSource()]);
    if (!parser.babelParser) {
      return "(TODO: unknown)";
    }

    const { point } = this.pointQueries;
    const steps = this.frameSteps;
    const idx = steps.findIndex(step => step.point === point);

    // 1. Get unique steps in each direction, picking the closest step to point.
    const previousSteps = (await this.getUniqueFrameSteps(steps.slice(0, idx).reverse())).reverse();
    const nextSteps = await this.getUniqueFrameSteps(steps.slice(idx + 1));
    const uniqueSteps = previousSteps.slice(-maxSteps).concat(nextSteps.slice(0, maxSteps));
    const functionInfo = (await this.pointQueries.queryFunctionInfo())!;

    // Just get labeled lines of code from the source code.
    const labeledCode = [TODO];
    const startStep = uniqueSteps[0];
    const endStep = uniqueSteps[uniqueSteps.length - 1];
    const startLine = startStep.line;
    const endLine = TODO;
    const missingPreviousLines = startLine - functionInfo.lines.start;
    const missingNextLines = functionInfo.lines.end - endLine;

    // Stub out all ancestor node headers of the node that contains the earliest line of code.
    const babelStartNode = parser.babelParser.getInnermostNodePathAt(startStep)!;
    const babelEndNode = parser.babelParser.getInnermostNodePathAt(endStep);
    const ancestorNodes = babelStartNode.getAncestry().reverse();
    // TODO: Add header + omission comment for each ancestor node

    // Add comments to inform about omissions.
    if (missingPreviousLines) {
      labeledCode.unshift(...TODO);
    }
    if (missingNextLines) {
      labeledCode.push(...TODO);
    }

    // Render final code.
    return labeledCode.join("\n");
  }
}
