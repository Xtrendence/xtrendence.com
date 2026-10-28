import * as path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { startAgentServer } from "./utils/agentServer.js";
import { startBackupScheduler } from "./utils/backups.js";
import { startConnectivityMonitor } from "./utils/connectivity.js";
import { startHistory } from "./utils/history.js";
import { startInternetRecovery } from "./utils/internetRecovery.js";
import { startDrillScheduler } from "./utils/restoreDrill.js";
import { startSelfHealing } from "./utils/selfHealing.js";
import { getAlertStatus, startHealthMonitor } from "./utils/serverAlerts.js";
import { startVaultMirrorWatch } from "./utils/vaultMirror.js";
import { syncProfiles } from "./utils/vpnProfiles.js";

// The privileged half of the website. It runs as xtrendence from xtrendence-agent.service and does
// everything that needs Docker, root (through the helper) or files the web process cannot read.
// The web process runs as apps and asks it over a socket, see utils/agentServer.js

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
	path: path.join(__dirname, "./.env"),
});

const devMode = !process.argv.includes("--prod");

startAgentServer();
startHealthMonitor({ notifyLights: !devMode });

// Production only, so a dev agent never duplicates these
if (!devMode) {
	startBackupScheduler();
	startDrillScheduler();
	startVaultMirrorWatch();
	startHistory({ alertStatus: getAlertStatus });
	startConnectivityMonitor();
	startInternetRecovery();
	startSelfHealing();
}

// Keeps the profiles folder matching the VPN's live profiles
const syncVpnProfiles = () =>
	syncProfiles().catch((error) => {
		console.log(`VPN profile sync failed: ${error?.message}`);
	});
setTimeout(syncVpnProfiles, 15 * 1000);
setInterval(syncVpnProfiles, 5 * 60 * 1000);
