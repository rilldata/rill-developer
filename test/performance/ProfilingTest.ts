import "../../src/moduleAlias";
import { FunctionalTestBase } from "../functional/FunctionalTestBase";
import { execSync } from "node:child_process";
import { RootConfig } from "$common/config/RootConfig";
import { DatabaseConfig } from "$common/config/DatabaseConfig";
import { StateConfig } from "$common/config/StateConfig";
import {
  EntityType,
  StateType,
} from "$common/data-modeler-state-service/entity-state-service/EntityStateService";

const PROFILING_TEST_FOLDER = "temp/profile";

export class ProfilingTest extends FunctionalTestBase {
  public async setup(): Promise<void> {
    execSync(`rm -rf ${PROFILING_TEST_FOLDER}/*`);
    execSync(`mkdir -p ${PROFILING_TEST_FOLDER}`);

    const config = new RootConfig({
      database: new DatabaseConfig({ databaseName: ":memory:" }),
      state: new StateConfig({ autoSync: true, syncInterval: 50 }),
      projectFolder: PROFILING_TEST_FOLDER,
      profileWithUpdate: true,
    });
    await super.setup(config);
  }

  public async verifyLargeImport(sourcePath: string): Promise<void> {
    await this.setup();

    console.log(`Importing ${sourcePath}`);
    console.time(sourcePath);

    await this.clientDataModelerService.dispatch("addOrUpdateSourceFromFile", [
      sourcePath,
    ]);

    console.timeEnd(sourcePath);

    await this.teardown();
  }

  public async verifyLargeModel(sourcePaths: Array<string>, query: string) {
    await this.setup();
    for (const sourcePath of sourcePaths) {
      console.log(`Importing ${sourcePath}`);
      await this.clientDataModelerService.dispatch(
        "addOrUpdateSourceFromFile",
        [sourcePath]
      );
    }
    await this.waitForSources();

    console.log(`Querying ${query}`);
    await this.clientDataModelerService.dispatch("addModel", [
      { name: "query" },
    ]);

    console.time(query);
    const model = await this.clientDataModelerStateService
      .getEntityStateService(EntityType.Model, StateType.Persistent)
      .getByField("sourceName", "query");
    await this.clientDataModelerService.dispatch("updateModelQuery", [
      model.id,
      query,
    ]);
    await this.waitForModels();
    const derived = await this.clientDataModelerStateService.getEntityById(
      EntityType.Model,
      StateType.Derived,
      model.id
    );
    console.log(derived.profile);

    console.timeEnd(query);

    await this.teardown();
  }
}

new ProfilingTest({}).verifyLargeImport(process.argv[2]);
