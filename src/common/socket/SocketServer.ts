import { Server } from "socket.io";
import type {DataModelerService} from "$common/data-modeler-service/DataModelerService";
import type {DataModelerStateService} from "$common/data-modeler-state-service/DataModelerStateService";
import type { RootConfig } from "$common/config/RootConfig";
import type { ClientToServerEvents, ServerToClientEvents } from "$common/socket/SocketInterfaces";
import type http from "http";
import type { MetricsService } from "$common/metrics-service/MetricsService";

/**
 * Socket server that applies actions from the client and emits the immer patches generated by the action back to client.
 */
export class SocketServer {
    private readonly server: Server<ClientToServerEvents, ServerToClientEvents>;

    constructor(private readonly config: RootConfig,
                private readonly dataModelerService: DataModelerService,
                private readonly dataModelerStateService: DataModelerStateService,
                private readonly metricsService: MetricsService,
                server?: http.Server) {
        this.server = new Server(server ?? {
            cors: { origin: this.config.server.serverUrl, methods: ["GET", "POST"] },
        });
    }

    public getSocketServer() {
        return this.server;
    }

    public async init(): Promise<void> {
        this.dataModelerStateService.subscribePatches((entityType, stateType, patches) => {
            this.server.emit("patch", entityType, stateType, patches);
        });

        this.server.on("connection", (socket) => {
            socket.emit("initialState", this.dataModelerStateService.getCurrentStates());
            socket.on("action", async (action, args, callback) => {
                if (callback) {
                    callback(await this.dataModelerService.dispatch(action, args));
                }
            });
            socket.on("metrics", async (event, args) => {
                await this.dataModelerService.fireEvent(event, args);
            });
        });
    }

    public async destroy(): Promise<void> {
        this.server.close();
    }
}
