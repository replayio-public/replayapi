/* Copyright 2020-2024 Record Replay Inc. */

import {
  ExecutionPoint,
  Frame,
  PauseId,
  NamedValue as ProtocolNamedValue,
  Value as ProtocolValue,
} from "@replayio/protocol";
import StaticScope from "@replayio/source-parser/src/bindings/StaticScope";
import SourceParser from "@replayio/source-parser/src/SourceParser";
import { CodeAtLocation, StaticFunctionInfo } from "@replayio/source-parser/src/types";
import createDebug from "debug";
import isEmpty from "lodash/isEmpty";
import truncate from "lodash/truncate";
import uniqBy from "lodash/uniqBy";
import protocolValueToText from "replay-next/components/inspector/protocolValueToText";
import { framesCache } from "replay-next/src/suspense/FrameCache";
import { frameStepsCache } from "replay-next/src/suspense/FrameStepsCache";
import { pointStackCache } from "replay-next/src/suspense/PointStackCache";
import { FrameScopes, frameScopesCache } from "replay-next/src/suspense/ScopeCache";
import { evaluate } from "replay-next/src/utils/evaluate";

import { AnalysisType } from "../analysis/dependencyGraphShared";
import { AnalysisInput } from "../analysis/dgSpecs";
import { runAnalysis } from "../analysis/runAnalysis";
import {
  ExecutionDataAnalysisResult,
  ExecutionDataAnalysisSpec,
  ExecutionDataEntry,
} from "../analysis/specs/executionPoint";
import { BigIntToPoint, ExecutionPointInfo } from "../util/points";
import DynamicScope from "./bindings/DynamicScope";
import DependencyChain, { RichStackFrame } from "./DependencyChain";
import { isDefaultHardcodedValueStub } from "./hardcodedCore";
import { lookupHardcodedData, wrapAsyncWithHardcodedData } from "./hardcodedData";
import ReplaySession from "./ReplaySession";
import {
  DependencyEventNode,
  EvaluateResult,
  ExpressionAnalysisResult,
  ExpressionDependencyResult,
  FrameStep,
  FrameWithPoint,
  IndexedPointStackFrame,
  InputDependency,
  InspectDataResult,
  InspectPointResult,
  LocationWithUrl,
  SimpleValuePreviewResult,
  UniqueFrameStep,
} from "./types";
import { compileGetTypeName } from "./values/previewValueUtil";

const debug = createDebug("replay:PointQueries");

const POINT_ANNOTATION = "/*POINT*/";

export interface BackendDataFlowAnalysisResult {
  entries: ExecutionDataEntry[];
}

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

  /**
   * NOTE: FrameScopes primarily provide values and nothing else.
   * @returns The dynamic values mapped to the current frame's scope and its parent scopes.
   */
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
   * Function Queries.
   * ##########################################################################*/

  async queryFunctionInfo(): Promise<StaticFunctionInfo | null> {
    const [thisLocation, parser] = await Promise.all([
      this.getSourceLocation(),
      this.parseSource(),
    ]);
    const functionInfo = parser.getFunctionInfoAt(thisLocation);
    // const functionSkeleton = this.getFunctionSkeleton();
    return functionInfo;
  }

  // async getFunctionSkeleton(): Promise<FunctionSkeleton | null> {
  //   const [thisLocation, parser] = await Promise.all([
  //     this.getSourceLocation(),
  //     this.parseSource(),
  //   ]);
  //   const functionSkeleton = parser.getFunctionSkeleton(thisLocation);
  //   return {};
  // }

  /** ###########################################################################
   * Frame steps.
   * ##########################################################################*/

  async getFrameSteps(): Promise<FrameStep[] | undefined> {
    const [frame, allSources, parser] = await Promise.all([
      this.thisFrame(),
      this.session.getSources(),
      this.parseSource(),
    ]);
    const frameId = frame.frameId;
    const pauseId = this.pauseId;
    const rawSteps = await frameStepsCache.readAsync(this.session, pauseId, frameId);
    return (
      rawSteps
        ?.filter(s => s.frame)
        ?.map(s => {
          const loc = allSources.getBestLocation(s.frame!);
          return {
            point: s.point,
            ...loc,
            index: parser.code.locationToIndex(loc),
          };
        }) || []
    );
  }

  async countStepHits(steps: FrameStep[]): Promise<UniqueFrameStep[]> {
    const [parser] = await Promise.all([this.parseSource()]);
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

  /** ###########################################################################
   * Code rendering.
   * ##########################################################################*/

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

  async queryFrameCodeAndLocation(): Promise<CodeAtLocation> {
    const [thisLocation, functionInfo, codeSummary, parser] = await Promise.all([
      this.getSourceLocation(),
      this.queryFunctionInfo(),
      this.queryCodeAndLocation(),
      this.parseSource(),
    ]);
    if (functionInfo?.name === "ElementStyle.populate") {
      // HARDCODE-HACKFIX (for 10608)
      // Just show the whole function to the agent.
      // TODO: Replace this with a slice from our new dynamic CFG.
      const functionNode = parser.getInnermostFunction(thisLocation)!;
      codeSummary.code = parser.getAnnotatedNodeTextAt(
        functionNode,
        POINT_ANNOTATION,
        thisLocation
      )![0];
    }
    return codeSummary;
  }

  /** ###########################################################################
   * Other high-level Queries.
   * ##########################################################################*/

  async shouldIncludeThisPoint(): Promise<boolean> {
    const thisLocation = await this.getSourceLocation();
    return shouldSourceBeIncluded(thisLocation.url);
  }

  async queryStackAndEvents(forceLookup = false): Promise<[boolean, RichStackFrame[]]> {
    return await this.dg.getNormalizedStackAndEventsAtPoint(this, forceLookup);
  }

  /** ###########################################################################
   * Value Queries.
   * ##########################################################################*/

  async protocolValueToText(value: ProtocolValue | ProtocolNamedValue): Promise<string | null> {
    try {
      return await protocolValueToText(this.session, value, this.pauseId);
    } catch (err: any) {
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
        value: "<ALREADY_SEEN/>",
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
    // const valueEval = await this.evaluate(`${compileMakePreview(expression)}`);
    const valueEval = await this.evaluate(expression);
    const { returned: value, exception } = valueEval;
    let valuePreview: string | null = null;
    let typePreview: string | null = null;
    if (value) {
      const typeEval = await this.evaluate(`${compileGetTypeName(expression)}`);
      [valuePreview, typePreview] = await Promise.all([
        // TODO: remove protocolValueToText since its previews are too long.
        this.protocolValueToText(value),
        (typeEval?.returned &&
          ("value" in typeEval.returned
            ? typeEval.returned.value // get value as-is
            : this.protocolValueToText(typeEval.returned))) ||
          null,
      ]);
    } else if (exception) {
      valuePreview = `<COULD_NOT_EVALUATE exception="${JSON.stringify((await this.protocolValueToText(exception)) || "(unknown)")}"/>`;
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

  private async supplementMissingDependencyData(
    node: DependencyEventNode,
    lookupLocation = true
  ): Promise<DependencyEventNode | null> {
    let { point, location, expression, value, ...other } = node;
    if (!point && !location && !expression) {
      return isEmpty(other) ? null : node;
    }
    const locationMissing = !location && lookupLocation;
    if (point && (locationMissing || !value)) {
      const pointQuery = await this.session.queryPoint(point);
      if (locationMissing) {
        // Look up location if not provided already.
        location = await pointQuery.queryCodeAndLocation();
      }
      if (!value && expression) {
        value = (await pointQuery.makeValuePreview(expression)) || undefined;
      }
      // TODO: calledFunction
    }
    if (node.children) {
      node.children = await Promise.all(
        node.children.map(
          async c =>
            // CalledFunction nodes already render relevant code.
            // Their children don't need to render their own location data.
            (await this.supplementMissingDependencyData(c, node.kind !== "CalledFunction"))!
        )
      );
    }
    return {
      point,
      location: location!,
      expression,
      value,
      ...other,
    };
  }

  private async queryDataFlow(
    expression: string,
    forceLookup = false
  ): Promise<ExpressionDependencyResult> {
    const [thisLocation, parser] = await Promise.all([
      this.getSourceLocation(),
      this.parseSource(),
    ]);

    // 1. Get data flow points from backend data flow results, and/or hardcoded overrides.
    let res = await wrapAsyncWithHardcodedData({
      recordingId: this.session.getRecordingId()!,
      name: "dependencyChain",
      forceLookup,
      input: { expression, point: this.point },
      cb: async ({ expression }): Promise<ExpressionDependencyResult | undefined> => {
        // TODO: Fix the analysis
        // const rawDataFlowResult = await this.runDataFlowAnalysis(expression);
        // let dataFlowPoints =
        //   rawDataFlowResult.entries.filter(p => !!p.associatedPoint).map(p => p.associatedPoint!) ||
        //   [];
        // dataFlowPoints = sortBy(dataFlowPoints, p => BigInt(p), "desc");
        // if (dataFlowPoints?.length) {
        //   return { dependencyChain: dataFlowPoints.map<DependencyNode>(p => ({ point: p })) };
        // }
        // return undefined;
        return undefined;
      },
    });

    // 2. Look up hardcoded object creation site when isValueReferenceType, but `dependencyChain` is empty.
    if ((await this.isValueReferenceType(expression)) && !res.dependencyChain?.length) {
      const hardcodedCreationSite = await lookupHardcodedData(
        this.session.getRecordingId()!,
        "objectCreationSite",
        { expression, point: this.point },
        null,
        forceLookup
      );
      if (!isDefaultHardcodedValueStub(hardcodedCreationSite)) {
        res = { ...res, objectCreationSite: hardcodedCreationSite };
      }
    }

    const dependencies = (
      await Promise.all(
        (res.dependencyChain || []).map<Promise<DependencyEventNode | null>>(o =>
          this.supplementMissingDependencyData(o)
        )
      )
    ).filter(x => !!x);

    // 3. Try to guess missing `location`s.
    return {
      staticBinding:
        (!dependencies?.length && parser.getBindingAt(thisLocation, expression)) || undefined,
      objectCreationSite:
        (res.objectCreationSite &&
          (await this.supplementMissingDependencyData(res.objectCreationSite))) ||
        undefined,
      dependencyChain: dependencies.length ? dependencies : undefined,
    };
  }

  /**
   * Preview and trace the data flow of the value held by `expression`.
   */
  private expressionInfoCache = new Map<string, Promise<ExpressionAnalysisResult>>();
  async queryExpressionInfo(expression: string, force = false): Promise<ExpressionAnalysisResult> {
    const cached = this.expressionInfoCache.get(expression);
    if (await cached) {
      return {
        expression,
        explanation: "<ALREADY_SEEN/>",
      };
    }

    const computeInfo = async () => {
      const [valuePreview, dataFlow] = await Promise.all([
        this.makeValuePreview(expression),
        this.queryDataFlow(expression, force),
      ]);

      return {
        expression,
        ...dataFlow,
        ...valuePreview,
      };
    };

    const infoPromise = computeInfo();
    this.expressionInfoCache.set(expression, infoPromise);
    return infoPromise;
  }

  async runExecutionPointAnalysis(
    extraSpecFields?: Partial<ExecutionDataAnalysisSpec>
  ): Promise<ExecutionDataAnalysisResult> {
    debug(`run ExecutionPoint analysis (${JSON.stringify(extraSpecFields)})...`);
    const analysisInput: AnalysisInput = {
      analysisType: AnalysisType.ExecutionPoint,
      spec: { recordingId: this.session.getRecordingId()!, point: this.point, ...extraSpecFields },
    };

    try {
      return await runAnalysis<ExecutionDataAnalysisResult>(this.session, analysisInput);
    } catch (err: any) {
      console.error(`PointQueries.runExecutionPointAnalysis FAILED - ${err.stack}`);
      return { points: [] };
    }
  }

  async runDataFlowAnalysis(expression: string): Promise<BackendDataFlowAnalysisResult> {
    const analysisResults = await this.runExecutionPointAnalysis({ value: expression, depth: 10 });
    // NOTE: `points` are all related to the given expression.
    const { points } = analysisResults;
    return {
      // TODO: handle the nonlinear case (multiple `entries` per point).
      entries: uniqBy(
        points.flatMap(p => p.entries),
        e => e.associatedPoint
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

    const deps = parser.getInterestingInputDependenciesAt(thisLocation);
    return (
      await Promise.all(
        deps.map(async dep => {
          const expression = dep.text;
          const info = await this.queryExpressionInfo(expression);
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
    const [location, functionInfo, /* inputDependencies, */ [stackTruncated, stackAndEvents]] =
      await Promise.all([
        this.queryFrameCodeAndLocation(),
        this.queryFunctionInfo(),
        // this.queryInputDependencies(),
        // null,
        this.queryStackAndEvents(true),
      ]);

    return {
      location,
      function: functionInfo,
      // inputDependencies,
      // TODO: directControlDependencies
      // directControlDependencies,
      stackAndEvents: stackAndEvents.length ? stackAndEvents : undefined,
      moreStackAndEvents: stackTruncated
        ? "There are more stackAndEvents. Inspect earlier entries to see more."
        : undefined,
    };
  }

  async inspectData(expression: string): Promise<InspectDataResult> {
    // 1. Get expression info first (so it won't be omitted).
    const expressionInfo = await this.queryExpressionInfo(expression, true);
    // 2. Then get all other info.
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
