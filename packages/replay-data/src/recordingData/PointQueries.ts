/* Copyright 2020-2024 Record Replay Inc. */

import {
  Result as EvaluationResult,
  ExecutionPoint,
  Frame,
  PauseId,
  NamedValue as ProtocolNamedValue,
  Value as ProtocolValue,
} from "@replayio/protocol";
import StaticScope from "@replayio/source-parser/src/bindings/StaticScope";
import SourceParser from "@replayio/source-parser/src/SourceParser";
import { StaticBinding } from "@replayio/source-parser/src/StaticBindings";
import createDebug from "debug";
import groupBy from "lodash/groupBy";
import isEmpty from "lodash/isEmpty";
import sortBy from "lodash/sortBy";
import truncate from "lodash/truncate";
import protocolValueToText from "replay-next/components/inspector/protocolValueToText";
import { framesCache } from "replay-next/src/suspense/FrameCache";
import { pointStackCache } from "replay-next/src/suspense/PointStackCache";
import { FrameScopes, frameScopesCache } from "replay-next/src/suspense/ScopeCache";
import { evaluate } from "replay-next/src/utils/evaluate";

import { AnalysisType } from "../analysis/dependencyGraphShared";
import { AnalysisInput } from "../analysis/dgSpecs";
import { runAnalysis } from "../analysis/runAnalysis";
import { ExecutionDataAnalysisResult, ExecutionDataEntry } from "../analysis/specs/executionPoint";
import { BigIntToPoint, ExecutionPointInfo } from "../util/points";
import DynamicScope from "./bindings/DynamicScope";
import DependencyChain, { RichStackFrame } from "./DependencyChain";
import { forceLookupHardcodedData, wrapAsyncWithHardcodedData } from "./hardcodedResults";
import ReplaySession from "./ReplaySession";
import {
  CodeAtLocation,
  FrameWithPoint,
  IndexedPointStackFrame,
  LocationWithUrl,
  PointFunctionInfo,
} from "./types";
import { compileGetTypeName } from "./values/previewValueUtil";

const debug = createDebug("replay:PointQueries");

const POINT_ANNOTATION = "/*BREAK*/";

export interface BackendDataFlowAnalysisResult {
  variablePointsByName: Record<string, ExecutionDataEntry[]>;
}

export interface InputDependency extends ExpressionAnalysisResult {
  expression: string;
}

export interface CodeAtPoint extends CodeAtLocation {
  point: ExecutionPoint;
}

export interface DataFlowOrigin {
  point?: ExecutionPoint;
  kind?: string;
  location?: CodeAtLocation;
  explanation?: string;
}

export interface ExpressionDataFlowResult {
  staticBinding?: StaticBinding;
  origins: DataFlowOrigin[];
}

export interface SimpleValuePreview {
  value?: string;
  type?: string;
}

export type SimpleValuePreviewResult = SimpleValuePreview | null;

export interface ExpressionAnalysisResult extends SimpleValuePreview, ExpressionDataFlowResult {
  expression: string;
}

export interface InspectPointResult {
  location: CodeAtLocation;
  function: PointFunctionInfo | null;
  inputDependencies: any; // TODO: Replace with proper type once implemented
  stackAndEvents: RichStackFrame[];
  stackAndEventsTruncated?: boolean;
}

export type InspectDataResult = InspectPointResult & ExpressionAnalysisResult;

export type EvaluateResult = {
  exception: EvaluationResult["exception"] | null;
  returned: EvaluationResult["returned"] | null;
};

export default class PointQueries {
  readonly session: ReplaySession;
  readonly point: ExecutionPoint;
  readonly pointData: ExecutionPointInfo;
  readonly pauseId: PauseId;
  readonly dg: DependencyChain;

  private parserPromise: Promise<SourceParser> | null = null;
  private readonly valueLookupsByExpression = new Map<string, Promise<SimpleValuePreviewResult>>();

  constructor(session: ReplaySession, point: ExecutionPoint, pauseId: PauseId) {
    this.session = session;
    this.pauseId = pauseId;
    this.point = point;
    this.pointData = BigIntToPoint(BigInt(point));
    this.dg = new DependencyChain(session);
  }

  /** ###########################################################################
   * Basic Queries.
   * ##########################################################################*/

  /**
   * @returns The stack as reported by the runtime. This is generally mostly the synchronous stack.
   */
  async getStackFrames(): Promise<Frame[]> {
    const frames = await framesCache.readAsync(this.session, this.pauseId);
    if (!frames?.length) {
      throw new Error(`[PointQueries] Stack is empty at point ${this.point}`);
    }
    return frames;
  }

  async getPointStack(frameIndex: number): Promise<IndexedPointStackFrame[]> {
    return await pointStackCache.readAsync(0, frameIndex, this.session, this.point);
  }

  async getStackFramesWithPoint(): Promise<FrameWithPoint[]> {
    const frames = await this.getStackFrames();
    const points = await this.getPointStack(frames.length - 1);
    return frames.map((frame: Frame, i) => ({ ...frame, point: points[i]!.point }));
  }

  async getAsyncStackFramesWithPoint(): Promise<FrameWithPoint[]> {
    // TODO: also get async frames where available.
    // NOTE: We have some rudimentary async stack support in devtools here:
    //        https://github.com/replayio/devtools/blob/main/src/devtools/client/debugger/src/components/SecondaryPanes/Frames/NewFrames.tsx#L62
    return [];
  }

  async thisFrame(): Promise<Frame> {
    const [thisFrame] = await this.getStackFrames();
    return thisFrame;
  }

  async thisFrameScopes(): Promise<FrameScopes> {
    const thisFrame = await this.thisFrame();
    return frameScopesCache.readAsync(this.session, this.pauseId, thisFrame.frameId);
  }

  /** ###########################################################################
   * Source Queries.
   * ##########################################################################*/

  async getSourceLocation(): Promise<LocationWithUrl> {
    const [thisFrame, allSources] = await Promise.all([
      this.thisFrame(),
      this.session.getSources(),
    ]);

    const thisLocation = allSources.getBestLocation(thisFrame.location);
    const url = allSources.getUrl(thisLocation.sourceId) || "";
    return {
      ...thisLocation,
      url,
    };
  }

  async parseSource(): Promise<SourceParser> {
    if (!this.parserPromise) {
      const [thisLocation, allSources] = await Promise.all([
        this.getSourceLocation(),
        this.session.getSources(),
      ]);

      if (!this.parserPromise) {
        this.parserPromise = allSources.parseContents(thisLocation.sourceId);
      }
    }
    return await this.parserPromise;
  }

  /** ###########################################################################
   * Other high-level Queries.
   * ##########################################################################*/

  async shouldIncludeThisPoint(): Promise<boolean> {
    const thisLocation = await this.getSourceLocation();
    return shouldSourceBeIncluded(thisLocation.url);
  }

  /**
   * Get data for the statement at `point`.
   */
  async queryCodeAndLocation(): Promise<CodeAtLocation> {
    const [thisLocation, parser] = await Promise.all([
      this.getSourceLocation(),
      this.parseSource(),
    ]);

    const [statementCode, startLoc] = parser.getAnnotatedNodeTextAt(
      thisLocation,
      POINT_ANNOTATION
    ) || ["", thisLocation];
    const functionInfo = parser.getFunctionInfoAt(startLoc);

    if (!thisLocation.url) {
      console.warn(`[PointQueries] No source url found at point ${this.point}`);
    }
    if (!statementCode) {
      console.warn(
        `[PointQueries] No statement code found at point ${this.point}, at:${JSON.stringify(thisLocation, null, 2)}`
      );
    }

    return {
      line: thisLocation.line,
      url: thisLocation.url,
      code: statementCode,
      functionName: functionInfo?.name || undefined,
    };
  }

  async queryFunctionInfo(): Promise<PointFunctionInfo | null> {
    const [thisLocation, parser] = await Promise.all([
      this.getSourceLocation(),
      this.parseSource(),
    ]);
    return parser.getFunctionInfoAt(thisLocation);
  }

  async queryStackAndEvents(): Promise<[boolean, RichStackFrame[]]> {
    return await this.dg.getNormalizedStackAndEventsAtPoint(this);
  }

  /** ###########################################################################
   * Value Queries.
   * ##########################################################################*/

  async protocolValueToText(value: ProtocolValue | ProtocolNamedValue): Promise<string | null> {
    try {
      return await protocolValueToText(this.session, value, this.pauseId);
    } catch (err: any) {
      // TODO: There is an error from `.yalc/shared/client/ReplayClient.ts`
      //   1. `getObjectWithPreview` calls `client.Pause.getObjectPreview` with `level = "none"` and gets an empty data object.
      //   2. When changing it to `level` = "canOverflow", it throws with "Message params not an object, null, or undefined" instead.
      console.error(
        `protocolValueToText ERROR: "${truncate(JSON.stringify(value), { length: 100 })}" → ${err.stack}`
      );
      return null;
    }
  }

  async makeValuePreview(expression: string): Promise<SimpleValuePreviewResult> {
    let res = this.valueLookupsByExpression.get(expression);
    if (!res) {
      this.valueLookupsByExpression.set(expression, (res = this._makeValuePreview(expression)));
    } else {
      // TODO: Also stub out nested repeated expressions.
      return {
        value: "<ALREADY_PREVIEWED/>",
      };
    }
    return res;
  }

  _valueEvals = new Map<string, Promise<EvaluateResult>>();

  async evaluate(expression: string): Promise<EvaluateResult> {
    const frame = await this.thisFrame();
    const frameId = frame.frameId;
    const pauseId = this.pauseId;
    let res = this._valueEvals.get(expression);
    if (!res) {
      this._valueEvals.set(
        expression,
        (res = evaluate({ replayClient: this.session, pauseId, text: expression, frameId }))
      );
    }
    return res;
  }

  async isValueReferenceType(expression: string): Promise<boolean> {
    const typeEval = await this.evaluate(expression);
    return !!typeEval?.returned?.object;
  }

  private async _makeValuePreview(expression: string): Promise<SimpleValuePreviewResult> {
    const valueEval = await this.evaluate(expression);
    const { returned: value, exception } = valueEval;
    let valuePreview: string | null = null;
    let typePreview: string | null = null;
    if (value) {
      const typeEval = await this.evaluate(`${compileGetTypeName(expression)}`);
      [valuePreview, typePreview] = await Promise.all([
        this.protocolValueToText(value),
        (typeEval?.returned &&
          ("value" in typeEval.returned
            ? typeEval.returned.value // get value as-is
            : this.protocolValueToText(typeEval.returned))) ||
          null,
      ]);
    } else if (exception) {
      // TODO: There is something wrong with protocolValueToText.
      // debug(`_makeValuePreview(${expression}) FAILED - ${await this.protocolValueToText(exception)}`);
      // valuePreview = `(COULD NOT EVALUATE: ${await this.protocolValueToText(exception)})`;
      // TODO: Better error handling.
      return null;
    } else {
      valuePreview = "<COULD_NOT_EVALUATE/>";
    }
    return {
      value: valuePreview || undefined,
      type: typePreview || undefined,
    };
  }

  /** ###########################################################################
   * ExecutionPoint + Data Flow Queries.
   * ##########################################################################*/

  private async queryDataFlow(
    expression: string,
    backendDataFlowResult: BackendDataFlowAnalysisResult
  ): Promise<ExpressionDataFlowResult> {
    const [thisLocation, parser] = await Promise.all([
      this.getSourceLocation(),
      this.parseSource(),
    ]);

    // 1. Get data flow points from backend data flow results, and/or hardcoded overrides.
    let res = await wrapAsyncWithHardcodedData(
      this.session.getRecordingId()!,
      "dataFlowPoints",
      { expression, point: this.point },
      async ({ expression }): Promise<ExpressionDataFlowResult | undefined> => {
        let dataFlowPoints =
          backendDataFlowResult.variablePointsByName[expression]
            ?.filter(p => !!p.associatedPoint)
            .map(p => p.associatedPoint!) || [];
        dataFlowPoints = sortBy(dataFlowPoints, p => BigInt(p), "desc");
        if (dataFlowPoints?.length) {
          return { origins: dataFlowPoints.map<DataFlowOrigin>(p => ({ point: p })) };
        }
        return undefined;
      }
    );

    // 2. Look up hardcoded object creation site when isValueReferenceType, but `origins` is empty.
    if ((await this.isValueReferenceType(expression)) && !res.origins?.length) {
      const hardcodedCreationSite = await forceLookupHardcodedData(
        this.session.getRecordingId()!,
        "objectCreationSite",
        { expression, point: this.point }
      );
      if (isEmpty(hardcodedCreationSite)) {
        console.error(
          `❌ [REPLAY_DATA_MISSING] Hardcoded for expression "${expression}" (POINT=${this.point}) missing.`
        );
      } else {
        res = { ...res, origins: [hardcodedCreationSite] };
      }
    }

    // 3. Try to guess missing `location`s.
    return {
      staticBinding: parser.getBindingAt(thisLocation, expression) || undefined,
      origins: (
        await Promise.all(
          (res.origins || []).map<Promise<DataFlowOrigin | null>>(
            async ({ point, location, ...other }) => {
              if (!location) {
                if (!point) {
                  return isEmpty(other) ? null : other;
                }

                // Look up location if not provided already.
                const pointQuery = await this.session.queryPoint(point);
                location = await pointQuery.queryCodeAndLocation();
              }
              return {
                point,
                location: location!,
                ...other,
              } as DataFlowOrigin;
            }
          )
        )
      ).filter(x => !!x),
    };
  }

  /**
   * Preview and trace the data flow of the value held by `expression`.
   */
  async queryExpressionInfo(
    expression: string,
    rawDataFlowResult?: BackendDataFlowAnalysisResult
  ): Promise<ExpressionAnalysisResult> {
    rawDataFlowResult ||= await this.runDataFlowAnalysis();
    const [valuePreview, dataFlow]: [SimpleValuePreviewResult, ExpressionDataFlowResult] =
      await Promise.all([
        this.makeValuePreview(expression),
        this.queryDataFlow(expression, rawDataFlowResult),
      ]);

    return {
      expression,
      ...valuePreview,
      ...dataFlow,
    };
  }

  async runExecutionPointAnalysis(depth?: number): Promise<ExecutionDataAnalysisResult> {
    debug(`run ExecutionPoint analysis (${depth})...`);
    const analysisInput: AnalysisInput = {
      analysisType: AnalysisType.ExecutionPoint,
      spec: { recordingId: this.session.getRecordingId()!, point: this.point },
    };
    if (depth !== undefined) {
      analysisInput.spec.depth = depth;
    }

    try {
      return await runAnalysis<ExecutionDataAnalysisResult>(this.session, analysisInput);
    } catch (err: any) {
      console.error(`PointQueries.runExecutionPointAnalysis FAILED - ${err.stack}`);
      return { points: [] };
    }
  }

  async runDataFlowAnalysis(): Promise<BackendDataFlowAnalysisResult> {
    const analysisResults = await this.runExecutionPointAnalysis();
    const { points } = analysisResults;
    return {
      variablePointsByName: groupBy<ExecutionDataEntry>(
        points.flatMap(p => p.entries),
        "value"
      ),
    };
  }

  /** ###########################################################################
   * Input Dependencies Queries.
   * ##########################################################################*/

  async queryInputDependencies(): Promise<InputDependency[]> {
    const [thisLocation, parser] = await Promise.all([
      this.getSourceLocation(),
      this.parseSource(),
    ]);

    const deps = parser.getInterestingInputDependencies(thisLocation);
    const dataFlowResult = await this.runDataFlowAnalysis();
    return (
      await Promise.all(
        deps.map(async dep => {
          const expression = dep.text;
          const info = await this.queryExpressionInfo(expression, dataFlowResult);
          if (info.value === undefined) {
            return null;
          }
          return {
            ...info,
          };
        })
      )
    ).filter(x => !!x);
  }

  async queryDynamicScopes(): Promise<DynamicScope[]> {
    const [thisLocation, frameScopes, parser] = await Promise.all([
      this.getSourceLocation(),
      this.thisFrameScopes(),
      this.parseSource(),
    ]);

    const staticScope = parser.scopes.getScopeAt(thisLocation);
    const recordedScopes = frameScopes.originalScopes || frameScopes.generatedScopes;

    // Store static scopes by parent in array.
    const staticScopes = [];
    let currentStaticScope: StaticScope | null = staticScope;
    while (currentStaticScope) {
      staticScopes.push(currentStaticScope);
      currentStaticScope = currentStaticScope.parent;
    }

    // Iterate scopes outer to inner.
    const scopes: DynamicScope[] = [];
    let lastScope: DynamicScope | null = null;
    for (let i = Math.max(staticScopes.length, recordedScopes.length) - 1; i >= 0; i--) {
      const currentStaticScope = staticScopes[i];
      const currentRecordedScope = recordedScopes[i];
      const newScope = (lastScope = new DynamicScope(
        this,
        lastScope,
        currentStaticScope,
        currentRecordedScope?.bindings || []
      ));
      scopes.push(newScope);
    }

    return scopes;
  }

  /** ###########################################################################
   * High-level inspect* queries.
   * ##########################################################################*/

  async inspectPoint(): Promise<InspectPointResult> {
    const [location, functionInfo, inputDependencies, [stackTruncated, stackAndEvents]] =
      await Promise.all([
        this.queryCodeAndLocation(),
        this.queryFunctionInfo(),
        this.queryInputDependencies(),
        // null,
        this.queryStackAndEvents(),
      ]);

    return {
      location,
      function: functionInfo,
      inputDependencies,
      // TODO: directControlDependencies
      // directControlDependencies,
      stackAndEvents,
      stackAndEventsTruncated: stackTruncated,
    };
  }

  async inspectData(expression: string): Promise<InspectDataResult> {
    const expressionInfo = await this.queryExpressionInfo(expression);
    const pointData = await this.inspectPoint();

    return {
      ...expressionInfo,
      ...pointData,
    };
  }

  // /**
  //  * TODO: Replace this w/ a combination of (i) summarization + (ii) in-frame point mappings.
  //  * Dynamic control dependencies from `point` to `thisFrame.startPoint` that are not already in `scopes`.
  //  */
  // async queryControlDependencies() {
  //   // TODO
  // }

  // /**
  //  *
  //  */
  // async valuePreview(expression: string) {
  //   // TODO
  // }
}

/**
 * Cull node_modules for now.
 */
function shouldSourceBeIncluded(url: string) {
  if (url.includes("node_modules")) {
    return false;
  }
  return true;
}
