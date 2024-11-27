interface WebSocketAnnotationCreate {
  kind: "create";
  socketId: number;
  url: string;
}

interface WebSocketAnnotationClose {
  kind: "close";
  socketId: number;
  code: number;
  reason: string;
}

export interface WebSocketAnnotationSend {
  kind: "send";
  socketId: number;
  binary: boolean;
  text?: string;
  encodedLength: number;
}

interface WebSocketAnnotationConnected {
  kind: "connected";
  socketId: number;
  subprotocol: string;
  extensions: string;
}

export interface WebSocketAnnotationNewMessage {
  kind: "newMessage";
  socketId: number;
  binary: boolean;
  text?: string;
  encodedLength: number;
}

interface WebSocketAnnotationOnError {
  kind: "onError";
  socketId: number;
}

interface WebSocketAnnotationOnClose {
  kind: "onClose";
  socketId: number;
}

export type WebSocketAnnotationContents =
  | WebSocketAnnotationCreate
  | WebSocketAnnotationClose
  | WebSocketAnnotationSend
  | WebSocketAnnotationConnected
  | WebSocketAnnotationNewMessage
  | WebSocketAnnotationOnError
  | WebSocketAnnotationOnClose;
