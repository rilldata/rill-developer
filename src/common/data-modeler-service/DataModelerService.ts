import type {DataModelerStateService} from "$common/data-modeler-state-service/DataModelerStateService";
import type {TableActions} from "$common/data-modeler-service/TableActions";
import type {ExtractActionTypeDefinitions, PickActionFunctions} from "$common/ServiceBase";
import type {DataModelerActions} from "$common/data-modeler-service/DataModelerActions";
import type {ProfileColumnActions} from "$common/data-modeler-service/ProfileColumnActions";
import type {ModelActions} from "$common/data-modeler-service/ModelActions";
import {getActionMethods} from "$common/ServiceBase";
import type {DataModelerState} from "$lib/types";
import type {DatabaseService} from "$common/database-service/DatabaseService";
import type { NotificationService } from "$common/notifications/NotificationService";

type DataModelerActionsClasses = PickActionFunctions<DataModelerState, (
    TableActions &
    ProfileColumnActions &
    ModelActions
)>;
/**
 * Style definition for data modeler actions.
 * Action => [...args]
 */
export type DataModelerActionsDefinition = ExtractActionTypeDefinitions<DataModelerState, DataModelerActionsClasses>;

/**
 * Higher order / compound actions within data modeler that can call multiple state updates and other actions within Data Modeler Service
 * Maps 1-1 with actions taken by the interface, either a UI or CLI.
 * Examples: addModel, updateModelQuery etc.
 * Use dispatch for taking actions.
 *
 * Is passed an array {@link DataModelerActions} instances.
 * Actions supported is dependent on these instances passed in the constructor.
 * One caveat to note, type definition and actual instances passed might not match.
 */
export class DataModelerService {
    /**
     * Map of action to {@link DataModelerActions} instance.
     * This might not have an entry for everything in DataModelerActionsDefinition.
     * Depends on the {@link DataModelerActions} with which this class is instantiated.
     * @private
     */
    private actionsMap: {
        [Action in keyof DataModelerActionsDefinition]?: DataModelerActionsClasses
    } = {};

    public constructor(protected readonly dataModelerStateService: DataModelerStateService,
                       private readonly databaseService: DatabaseService,
                       private readonly notificationService: NotificationService,
                       private readonly dataModelerActions: Array<DataModelerActions>) {
        dataModelerActions.forEach((actions) => {
            actions.setDataModelerActionService(this);
            actions.setNotificationService(notificationService);
            getActionMethods(actions).forEach(action => {
                this.actionsMap[action] = actions;
            });
        });
    }

    public async init(state?: DataModelerState): Promise<void> {
        this.dataModelerStateService.init(state);
        await this.databaseService?.init();
    }

    /**
     * Forwards action to the appropriate class.
     * @param action
     * @param args
     */
    public async dispatch<Action extends keyof DataModelerActionsDefinition>(
        action: Action, args: DataModelerActionsDefinition[Action],
    ): Promise<void> {
        if (!this.actionsMap[action]?.[action]) {
            console.log(`${action} not found`);
            return;
        }
        const actionsInstance = this.actionsMap[action];
        // this.dataModelerStateService.dispatch("setStatus", [RUNNING_STATUS]);
        await actionsInstance[action].call(actionsInstance, this.dataModelerStateService.getCurrentState(), ...args);
        // this.dataModelerStateService.dispatch("setStatus", [IDLE_STATUS]);
    }

    public async destroy(): Promise<void> {}
}
