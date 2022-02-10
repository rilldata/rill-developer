import { Server } from "socket.io";
import type {DataModelerService} from "$common/data-modeler-service/DataModelerService";
import type {DataModelerStateService} from "$common/data-modeler-state-service/DataModelerStateService";
import type { RootConfig } from "$common/config/RootConfig";
import {existsSync, readFileSync, writeFileSync} from "fs";

export class SocketServer {
    private readonly server: Server;

    constructor(private readonly dataModelerService: DataModelerService,
                private readonly dataModelerStateService: DataModelerStateService,
                private readonly config: RootConfig) {
        this.server = new Server({
            cors: { origin: this.config.server.serverUrl, methods: ["GET", "POST"] },
        });
    }

    public async init(): Promise<void> {
        await this.dataModelerService.init();
        this.readInitialState();

        this.dataModelerStateService.subscribePatches((patches) => {
            this.server.emit("patch", patches);
        });

        this.server.on("connection", (socket) => {
            console.log("New connection", socket.id);
            socket.emit("init-state", this.dataModelerStateService.getCurrentState());
            socket.on("action", async (action, args) => {
                await this.dataModelerService.dispatch(action, args);
            });
        });

        this.server.listen(this.config.server.socketPort);

        this.readSourceFolder();
        this.syncStateToFile();
    }

    public async destroy(): Promise<void> {
        this.server.close();
    }

    private readInitialState() {
        if (existsSync(this.config.state.savedStateFile)) {
            this.dataModelerStateService.updateState(
              JSON.parse(readFileSync(this.config.state.savedStateFile).toString()));
        }
    }

    private syncStateToFile() {
        setInterval(() => {
			      writeFileSync(this.config.state.savedStateFile,
              JSON.stringify(this.dataModelerStateService.getCurrentState()));
		    }, 500);
    }

    private readSourceFolder() {
        this.dataModelerService.dispatch("updateDatasetsFromSource",
          [this.config.database.parquetFolder]);
        setInterval(() => {
            this.dataModelerService.dispatch("updateDatasetsFromSource",
              [this.config.database.parquetFolder]);
        }, 1000);
    }
}
