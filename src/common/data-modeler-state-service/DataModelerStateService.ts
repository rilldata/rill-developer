import type { DataModelerState } from "$lib/types";
import type { SourceStateActions } from "./SourceStateActions";
import type { ModelStateActions } from "./ModelStateActions";
import type { ProfileColumnStateActions } from "./ProfileColumnStateActions";
import type { ExtractActionTypeDefinitions } from "$common/ServiceBase";
import type { StateActions } from "$common/data-modeler-state-service/StateActions";
import { writable } from "svelte/store";
import type { Writable } from "svelte/store";
import { enablePatches } from "immer";
import type { Patch } from "immer";
import { initialState } from "../stateInstancesFactory";
import { getActionMethods } from "$common/ServiceBase";
import type { PickActionFunctions } from "$common/ServiceBase";
import type { RootConfig } from "$common/config/RootConfig";
import {
  EntityStateService,
  EntityType,
  StateType,
} from "$common/data-modeler-state-service/entity-state-service/EntityStateService";
import type {
  EntityState,
  EntityStateActionArg,
} from "$common/data-modeler-state-service/entity-state-service/EntityStateService";
import type {
  EntityRecordMapType,
  EntityStateServicesMapType,
} from "$common/data-modeler-state-service/entity-state-service/EntityStateServicesMap";
import type { CommonStateActions } from "$common/data-modeler-state-service/CommonStateActions";
import type { ApplicationStateActions } from "$common/data-modeler-state-service/ApplicationStateActions";
import type { ApplicationState } from "./entity-state-service/ApplicationEntityService";
import { BatchedStateUpdate } from "$common/data-modeler-state-service/BatchedStateUpdate";

enablePatches();

type DataModelerStateActionsClasses = PickActionFunctions<
  EntityStateActionArg<any>,
  SourceStateActions &
    ModelStateActions &
    ProfileColumnStateActions &
    CommonStateActions &
    ApplicationStateActions
>;
export type DataModelerStateActionsDefinition = ExtractActionTypeDefinitions<
  EntityStateActionArg<any>,
  DataModelerStateActionsClasses
>;

export type PatchesSubscriber = (
  entityType: EntityType,
  stateType: StateType,
  patches: Array<Patch>
) => void;

export type EntityTypeAndStates = Array<
  [EntityType, StateType, EntityState<any>]
>;

// Actions that need throttling.
// Contains column profile actions
const ThrottleActions = {
  updateColumnSummary: true,
  updateNullCount: true,
};

/**
 * Lower order actions that update the Rill Developer state directly and somewhat atomically.
 * Use dispatch for taking actions.
 *
 * Takes an array of {@link StateActions} instances.
 * Actions supported is dependent on these instances passed in the constructor.
 * One caveat to note, type definition and actual instances passed might not match.
 *
 * Emits immer patches. These patches are forwarded to client by {@link SocketServer}
 */
export class DataModelerStateService {
  public store: Writable<DataModelerState>;

  private readonly actionsMap: {
    [Action in keyof DataModelerStateActionsDefinition]?: DataModelerStateActionsClasses;
  } = {};
  private readonly entityStateServicesMap: EntityStateServicesMapType = {};

  private patchesSubscribers: Array<PatchesSubscriber> = [];

  private batchedStateUpdate: BatchedStateUpdate;

  public constructor(
    private readonly stateActions: Array<StateActions>,
    public readonly entityStateServices: Array<EntityStateService<any>>,
    protected readonly config?: RootConfig
  ) {
    stateActions.forEach((actions) => {
      getActionMethods(actions).forEach((action) => {
        this.actionsMap[action] = actions;
      });
    });
    entityStateServices.forEach((entityStateService) => {
      this.entityStateServicesMap[entityStateService.entityType] ??= {};
      (this.entityStateServicesMap[entityStateService.entityType] as any)[
        entityStateService.stateType
      ] = entityStateService;
    });

    this.batchedStateUpdate = new BatchedStateUpdate(
      (patches, entityType, stateType) => {
        this.patchesSubscribers.forEach((subscriber) =>
          subscriber(entityType, stateType, patches)
        );
      }
    );
  }

  public async init(): Promise<void> {
    this.store = writable(initialState());
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async destroy(): Promise<void> {}

  public getCurrentStates(): EntityTypeAndStates {
    return this.entityStateServices.map((entityStateService) => [
      entityStateService.entityType,
      entityStateService.stateType,
      entityStateService.getCurrentState(),
    ]);
  }

  /**
   * Subscribe to patch emitted by immer.
   * @param subscriber
   */
  public subscribePatches(subscriber: PatchesSubscriber): void {
    this.patchesSubscribers.push(subscriber);
  }

  public updateState(entityTypeAndStates: EntityTypeAndStates): void {
    entityTypeAndStates.forEach(([entityType, stateType, state]) => {
      const service = this.entityStateServicesMap[entityType]?.[stateType];
      if (!service) {
        console.error(
          `Service not found. entityType=${entityType} stateType=${stateType}`
        );
        return;
      }
      service.store.set(state as any);
    });
  }

  /**
   * Forwards action to the appropriate class.
   * @param action
   * @param args
   */
  public dispatch<Action extends keyof DataModelerStateActionsDefinition>(
    action: Action,
    args: DataModelerStateActionsDefinition[Action]
  ): void {
    if (!this.actionsMap[action]?.[action]) {
      console.error(`${action} not found`);
      return;
    }
    const actionsInstance = this.actionsMap[action];
    const stateTypes = (actionsInstance?.constructor as typeof StateActions)
      .actionToStateTypesMap[action];
    if (!stateTypes) {
      console.error(`No state types defined for ${action}`);
      return;
    }

    const stateService =
      this.entityStateServicesMap[stateTypes[0] ?? (args[0] as any)]?.[
        stateTypes[1] ?? (args[1] as any)
      ];
    this.updateStateAndEmitPatches(
      stateService,
      (draftState) => {
        actionsInstance[action].call(
          actionsInstance,
          { stateService, draftState },
          ...args
        );
      },
      action in ThrottleActions
    );
  }

  public applyPatches(
    entityType: EntityType,
    stateType: StateType,
    patches: Array<Patch>
  ): void {
    this.entityStateServicesMap[entityType][stateType].applyPatches(patches);
  }

  public getEntityStateService<
    EntityTypeArg extends EntityType,
    StateTypeArg extends StateType
  >(
    entityType: EntityTypeArg,
    stateType: StateTypeArg
  ): EntityStateServicesMapType[EntityTypeArg][StateTypeArg] {
    return this.entityStateServicesMap[entityType][stateType];
  }
  public getApplicationState(): ApplicationState {
    return this.getEntityStateService(
      EntityType.Application,
      StateType.Derived
    ).getCurrentState();
  }

  public getEntityById<
    EntityTypeArg extends EntityType,
    StateTypeArg extends StateType
  >(
    entityType: EntityTypeArg,
    stateType: StateTypeArg,
    entityId: string
  ): EntityRecordMapType[EntityTypeArg][StateTypeArg] {
    return this.entityStateServicesMap[entityType][stateType].getById(
      entityId
    ) as any;
  }

  public updateStateAndEmitPatches(
    service: EntityStateService<any>,
    callback: (draft) => void,
    throttle = false
  ) {
    if (throttle) {
      this.batchedStateUpdate.updateState(service, callback);
    } else {
      // call through for to make sure state is up-to-date
      this.batchedStateUpdate.callThrough(service);
      service.updateState(
        (draft) => {
          callback(draft);
          draft.lastUpdated = Date.now();
        },
        (patches) => {
          this.patchesSubscribers.forEach((subscriber) =>
            subscriber(service.entityType, service.stateType, patches)
          );
        }
      );
    }
  }

  public async waitForAllUpdates(
    entityType: EntityType,
    stateType: StateType
  ): Promise<void> {
    setImmediate(() => {
      this.batchedStateUpdate.callThrough(
        this.entityStateServicesMap[entityType][stateType]
      );
    });
    await this.batchedStateUpdate.waitForNextUpdate(entityType, stateType);
  }
}
