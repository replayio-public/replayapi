/* Copyright 2020-2024 Record Replay Inc. */

import { ExecutionPoint } from "@replayio/protocol";

export interface URLLocation {
  sourceId: string;
  line: number;
  column: number;
  url: string;
}

export interface FunctionInfo {
  name?: string;
  location: URLLocation;

  // return for callers or for other precise points (like consume points)
  point?: ExecutionPoint;

  // returned for callees when
  startPoint?: ExecutionPoint;
  endPoint?: ExecutionPoint;
}

// Description of a dependency associated with a library.
export interface LibraryDependencyInfo {
  point: ExecutionPoint;
  library: string;
  reason: string;
  functionInfo: FunctionInfo | undefined;
}

// Reasons why we might not find a library dependency.
export enum LibraryDependencyFailure {
  // The execution point isn't associated with a known library.
  NotLibraryCode = "NotLibraryCode",

  // The execution point is part of a library but we were unable to find a dependency.
  MissingDependency = "MissingDependency",

  // The execution point is part of a library but there are no dependencies, this is the final point
  Exhausted = "Exhausted",
}

export type NewNodeInfo =
  | {
      kind:
        | "promiseSettled"
        | "enqueueMicrotask"
        | "runMicrotask"
        | "timerFired"
        | "pendingScriptCreated"
        | "pendingScriptReady"
        | "executePendingScript"
        | "executeAsyncScript"
        | "scheduleExecuteAsyncScript"
        | "scriptStreamingComplete"
        | "documentLoaded"
        | "documentBeforeUnload"
        | "documentUnloaded"
        | "documentNotifyScriptLoaded"
        | "deferredDocumentPumpTokenizer"
        | "documentSchedulePumpTokenizer"
        | "documentScheduleExecuteScriptsWaitingForResources"
        | "documentStartLoadingResponse"
        | "scheduleNotifyScriptLoaded"
        | "renderFrameNavigate"
        | "renderFrameUnload"
        | "imageLoaderCreated"
        | "imageError"
        | "dispatchImageErrorEvent"
        | "scheduleImageUpdateTask"
        | "lazyImageNearViewport"
        | "intersectionChanged"
        | "downloadImage"
        | "workerHostCreated"
        | "executeIdleCallback"
        | "observeResize"
        | "resolveBodyConsumer";
    }
  | {
      kind: "newPromise";
      persistentId: number;
    }
  | {
      kind:
        | "executeScriptBlock"
        | "scheduleScriptStreamingTask"
        | "documentPumpTokenizer"
        | "documentUpdateStyle"
        | "documentFinishedParsing"
        | "documentExecuteScriptsWaitingForResources"
        | "xhrReadyStateChangeEvent"
        | "xhrEndLoading"
        | "imageLoaded"
        | "imageUpdateFromElement"
        | "resourceAlreadyLoaded"
        | "resourceResponseReceived"
        | "resourceFinished"
        | "scheduleResolveBodyConsumer";
      url: string;
    }
  | {
      kind: "marker";
      reason: "ExecuteScript" | "LoadEventDelay";
      name: string;
    }
  | {
      kind: "timerScheduled";
      duration: number;
      singleShot: boolean;
    }
  | {
      kind: "documentAppendString";
      url: string;
      length: number;
    }
  | {
      kind: "networkRequest";
      requestId: string;
    }
  | {
      kind: "networkReceiveData";
      requestId: string;
      length: number;
    }
  | {
      kind: "receivedRedirect";
      original_url: string;
      new_url: string;
    }
  | {
      kind: "postMessage";
      messageId: number;
      processId: number;
    }
  | {
      kind: "acceptMessage";
      messageId: number;
      processId: number;
      currentProcessId: number;
    }
  | {
      kind: "websocketConnected" | "websocketSendMessage" | "websocketNewMessage";
      socketId: number;
    }
  | {
      kind: "websocketCreated";
      socketId: number;
      url: string;
    }
  | {
      kind: "dispatchEvent";
      type: string;
    }
  | {
      kind: "domMutation";
      mutationType: string;
      mutationNode: number;
    };

interface DependencyGraphEntryNode {
  kind: "node";
  id: number;
  progress: number;
  hit?: ExecutionPoint;
  info: NewNodeInfo;
}

export type NewEdgeInfo = {
  kind:
    | "scheduler"
    | "creator"
    | "basePromise"
    | "parentPromise"
    | "baseTimer"
    | "loadEventDelay"
    | "imageLoader";
};

interface DependencyGraphEntryEdge {
  kind: "edge";
  progress: number;
  source: number;
  target: number;
  info: NewEdgeInfo;
}

interface DependencyGraphEntryExecution {
  kind: "execution";
  progress: number;
  id: number;
}

interface DependencyGraphEntryEndExecution {
  kind: "endExecution";
  progress: number;
}

export interface DependencyGraphEntryTime {
  kind: "time";
  progress: number;
  time: number;
}

export type DependencyGraphEntry =
  | DependencyGraphEntryNode
  | DependencyGraphEntryEdge
  | DependencyGraphEntryExecution
  | DependencyGraphEntryEndExecution
  | DependencyGraphEntryTime;

// Nodes can either be specified by the application or be fabricated
// for specific execution points.
export type AnyNodeInfo = NewNodeInfo | { kind: "point" };

export interface LibraryEdgeInfo {
  kind: "library";
  info: LibraryDependencyInfo;
}

// Edges can either be specified by the application or implicit edges
// we construct from other data.
export type AnyEdgeInfo =
  | NewEdgeInfo
  // Implicit edge when the source node was executing while the target was created.
  | {
      kind: "executionParent";
      executionStartTime: number;
    }
  // Implicit edge when the source node was executing while an execution point
  // associated with the target was hit.
  | {
      kind: "executionPoint";
      point: ExecutionPoint;
      executionStartTime: number;
    }
  // Implicit edge when the source is some data received over the network which
  // triggers the target.
  | {
      kind: "networkReceiveData";

      // Set if the data received is for the initial document loading. This initial
      // load does not have an associated graph node for the request itself.
      initialDocument?: boolean;
    }
  // Implicit edge when the source is a network request and the target is data
  // being received for that request.
  | { kind: "networkRequest" }
  // Implicit edge from a websocket message that was sent to an associated response.
  | { kind: "websocketMessage" }
  // Implicit edge from a websocket creation to the point where connection finished.
  | { kind: "websocketCreated" }
  // Implicit edge from code called by a library with custom handling to application
  // code which triggered the later call.
  | LibraryEdgeInfo;

type UnknownDependencyChainStepInfo =
  | {
      code: "UnknownNode";
      node: AnyNodeInfo;
    }
  | {
      code: "UnknownEdge";
      edge: AnyEdgeInfo;
    };

type ReactDependencyChainStepInfo =
  | {
      // React's createRoot(...).render() was called.
      code: "ReactRootRender";
    }
  | {
      // React hydration has started.
      code: "ReactHydrateRoot";
    }
  | {
      // React has rendered a component.
      code: "ReactRender";
      functionLocation?: URLLocation;
      functionName?: string;
    }
  | {
      // React was able to resume rendering after a suspense promise resolved.
      code: "ReactResumeSuspendedRender";
    }
  | {
      // An application render function returned an existing element object for
      // converting into a component.
      code: "ReactReturnElement";
    }
  | {
      // An application render function created an element object for converting
      // into a component.
      code: "ReactCreateElement";
    }
  | {
      // An application render function called setState().
      code: "ReactCallSetState";
    }
  | {
      // A React external store triggered a rerender.
      code: "ReactExternalStoreRerender";
    }
  | {
      // An application render function called useEffect/useLayoutEffect/etc.
      code: "ReactCreateEffect";
      functionLocation?: URLLocation;
      functionName?: string;
    }
  | {
      // An effect hook is called after the original useEffect/useLayoutEffect/etc created it in render.
      code: "ReactCallEffect";
      functionLocation?: URLLocation;
      functionName?: string;
    }
  | {
      // A change which triggered a render led to a later commit.
      code: "ReactRenderCommit";
    };

type DependencyChainStepInfo =
  | {
      // The document has started to load.
      code: "DocumentBeginLoad";
      url: string;
    }
  | {
      // A script in a document began execution after all other required
      // resources were received.
      code: "DocumentExecuteBlockedScript";
      url: string;
    }
  | {
      // A script in a document began execution after being downloaded.
      code: "DocumentExecuteScript";
      url: string;
    }
  | {
      // A script in a document has been scheduled for async compilation.
      code: "DocumentAsyncCompileScript";
      url: string;
    }
  | {
      // A network request referenced by a document's contents was initiated.
      code: "DocumentInitiateNetworkRequest";
      url: string;
    }
  | {
      // A script triggered a network request.
      code: "ScriptInitiateNetworkRequest";
      url: string;
    }
  | {
      // Some data has been received over the network.
      code: "NetworkReceiveData";
      numBytes: number;
    }
  | {
      // A network resource finished being received.
      code: "NetworkReceiveResource";
    }
  | {
      // Event handlers for user input were called.
      code: "DispatchInputEventHandler";
      type: string;
    }
  | {
      // A script created a new websocket.
      code: "ScriptCreateWebSocket";
      url: string;
    }
  | {
      // A websocket connected and open handlers were called.
      code: "WebSocketConnected";
    }
  | {
      // A script sent a message over a websocket. It was determined that this is a request for a message received and handled later.
      code: "ScriptSendWebSocketMessage";
    }
  | {
      // A websocket message received and message handlers were called.
      code: "WebSocketMessageReceived";
    }
  | {
      code: "PostMessageReceived";
      time: number;
    }
  | {
      // A promise settled and its then/catch hooks were called.
      code: "PromiseSettled";
    }
  | ReactDependencyChainStepInfo
  | UnknownDependencyChainStepInfo;

export type DependencyChainStep = DependencyChainStepInfo & {
  time?: number;
  point?: ExecutionPoint;
};
/* Copyright 2020-2024 Record Replay Inc. */

// Options for changing how the dependency graph behaves. This is defined in its
// own file to avoid circular imports.

// Modes which change the way in which dependency edges are followed.
export enum DependencyGraphMode {
  /**
   * Renders of a fiber depend on the last time the owner of that fiber was
   * rendered, instead of whatever triggered the fiber's render.
   */
  ReactOwnerRenders = "ReactOwnerRenders",
  /** Returns a list of render points of the enclosing rendering fiber */
  ReactInstanceRenders = "ReactInstanceRenders",
}

// Options that can be set for a dependency graph.
export interface DependencyGraphOptions {
  // Follow React related dependency edges.
  allowReact?: boolean;

  // Override the default strategy for computing dependencies.
  mode?: DependencyGraphMode;
}

export interface AnalyzeDependenciesResult {
  dependencies: DependencyChainStep[];
}

export interface AnalyzeDependenciesSpec {
  recordingId: string;
  point: ExecutionPoint;
  mode?: DependencyGraphMode | undefined;
}

export interface AnalyzeDependenciesOptions {
  server: string;
  diskCacheDirPath?: string;
  apiKey?: string;
}
