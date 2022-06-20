export enum ActionResponseMessageType {
  Info,
  Error,
}

export enum ActionErrorType {
  Unknown,
  ActionDefinition,
  EntityError,
  ExistingEntityError,
  ImportSource,
  ModelQuery,
  QueryCancelled,
}

export interface ActionResponseMessage {
  type: ActionResponseMessageType;
  errorType?: ActionErrorType;
  stack?: string;
  message: string;
}
