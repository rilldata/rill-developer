import {EntityRepository} from "$common/data-modeler-state-service/sync-service/EntityRepository";
import type {
    PersistentModelEntity
} from "$common/data-modeler-state-service/entity-state-service/PersistentModelEntityService";
import type {StateConfig} from "$common/config/StateConfig";
import type {EntityType, StateType} from "$common/data-modeler-state-service/entity-state-service/EntityStateService";
import {existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync, unlinkSync} from "fs";
import type {EntityState} from "$common/data-modeler-state-service/entity-state-service/EntityStateService";
import type {DataModelerService} from "$common/data-modeler-service/DataModelerService";
import {execSync} from "node:child_process";

export class PersistentModelRepository extends EntityRepository<PersistentModelEntity> {
    private readonly saveDirectory: string;
    private filesForEntities: Map<string, string>;

    constructor(
        stateConfig: StateConfig,
        dataModelerService: DataModelerService,
        entityType: EntityType, stateType: StateType,
    ) {
        super(stateConfig, dataModelerService, entityType, stateType);
        this.saveDirectory = stateConfig.modelFolder;
        if (!existsSync(this.saveDirectory)) {
            mkdirSync(this.saveDirectory, {recursive: true});
        }
    }

    /**
     * Persist the entity query to file.
     */
    public async save(entity: PersistentModelEntity): Promise<void> {
        writeFileSync(
            `${this.saveDirectory}/${this.getFileName(entity)}`,
            this.getFileContent(entity),
        );
    }

    public async getAll(): Promise<EntityState<PersistentModelEntity>> {
        const currentFiles = new Map<string, string>();
        // store ids of previous entity for the file
        // in case it is a new file then store an empty string
        readdirSync(this.saveDirectory).forEach(file =>
            currentFiles.set(file, this.filesForEntities?.get(file) ?? ""));

        const entityState = await super.getAll();

        // build the new map of file name to entity id
        this.filesForEntities = new Map<string, string>();
        entityState.entities.forEach(entity =>
            this.filesForEntities.set(this.getFileName(entity), entity.id));

        // go through all current files.
        currentFiles.forEach((id, currentFile) => {
            // if a file has an entry in new map ignore it.
            if (this.filesForEntities.has(currentFile)) return;
            const fullCurrentFile = `${this.saveDirectory}/${currentFile}`;

            if (id) {
                // if the file has no entry in new map but has an id in currentFiles then remove the file.
                // this was a possible rename
                unlinkSync(fullCurrentFile);
            } else {
                // else this a file added from outside.
                // create a new model
                setTimeout(() => {
                    this.createEntity(currentFile, readFileSync(fullCurrentFile).toString());
                    // add a small timeout to make sure it runs after the sync ends
                }, 5);
            }
        });

        return entityState;
    }

    /**
     * Update specific fields in entity based on id or any other field
     */
    public async update(entity: PersistentModelEntity): Promise<boolean> {
        const modelFileName = `${this.saveDirectory}/${this.getFileName(entity)}`;
        // if file was deleted for any reason, recreate instead of throwing error
        // NOTE: we currently do not support deleting entity by deleting the file
        if (!existsSync(modelFileName)) {
            await this.save(entity);
            return false;
        }

        const newQuery = readFileSync(modelFileName).toString();
        const fileUpdated = statSync(modelFileName).mtimeMs;
        if (this.contentHasChanged(entity, newQuery) && fileUpdated > entity.lastUpdated) {
            this.updateEntity(entity, newQuery);
            entity.lastUpdated = Date.now();
            return true;
        }
        return false;
    }

    // adding some abstraction in anticipation of other entities persisting to files
    protected getFileName(entity: PersistentModelEntity): string {
        return entity.name;
    }
    protected getFileContent(entity: PersistentModelEntity): string {
        return entity.query;
    }
    protected updateEntity(entity: PersistentModelEntity, newContent: string): void {
        entity.query = newContent;
    }
    protected contentHasChanged(entity: PersistentModelEntity, newContent: string): boolean {
        return newContent !== entity.query;
    }

    protected async createEntity(fileName: string, fileContent: string) {
        return this.dataModelerService.dispatch(
            "addModel", [{name: fileName, query: fileContent}]);
    }
}
