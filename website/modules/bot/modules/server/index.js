import { commonTriggerChecks } from "../../utils/utils.js";
import { serverAddress, shareServer } from "./server.js";

export const abilities = [
	{
		name: "server",
		ability: () => "server",
		description: "Say module name.",
		triggers: ["/server"],
		triggerCheck: commonTriggerChecks.equals,
	},
	{
		name: serverAddress.name,
		ability: serverAddress,
		description: "Get the server's IP addresses.",
		triggers: [
			"what is the server address",
			"what is the server ip",
			"get server ip",
			"server ip address",
			"show server address",
			"show server ip",
			"server ip",
			"server address",
			"/server address",
			"/server ip",
			"/serverAddress",
			"/serverIp",
		],
		triggerCheck: commonTriggerChecks.equals,
	},
	{
		name: shareServer.name,
		ability: shareServer,
		description: "Make a view-only share code for the server dashboard.",
		triggers: [
			"share the server",
			"share server",
			"server share code",
			"share code",
			"share the dashboard",
			"share dashboard",
			"server view link",
			"/server share",
			"/share",
		],
		triggerCheck: commonTriggerChecks.includes,
	},
];
