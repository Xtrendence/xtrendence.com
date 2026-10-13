export type TLight = {
	id: string;
	created_at: string;
	updated_at: string;
	mac: string;
	ip: string;
	name: string;
};

export type TBulbConfig = {
	id: number;
	name: string;
	ip: string;
	mac: string;
};

export type TAlertLevel = "ok" | "soft" | "hard";

export type TAlertSettings = {
	enabled: boolean;
	bulbId: number | null;
};

export type TPlugConfig = {
	id: number;
	name: string;
	ip: string;
	// Off for a moment and back on, this often
	intervalHours: number;
	// Daily times a restart is moved out of, in the server's time zone
	quietHours?: TQuietRange[];
};

// "HH:MM", and an end before the start runs past midnight
export type TQuietRange = { start: string; end: string };

export type TPlugStatus = {
	// Its own web page answers with 200
	online: boolean;
	busy: boolean;
	lastCycleAt: number | null;
	lastResult: "ok" | "failed" | null;
	lastError: string | null;
	nextCycleAt: number;
	// When the restart would have been, if quiet hours moved it
	movedFrom: number | null;
	pendingOn: boolean;
};

export type TSettings = {
	lights: TBulbConfig[];
	climateHosts: string[];
	alerts: TAlertSettings;
	plugs: TPlugConfig[];
	// Read only, the last level the server reported
	alertLevel?: TAlertLevel | null;
};

export type TDeviceInfo = {
	avatar: string;
	brightness: number;
	color_temp: number;
	color_temp_range: [number, number];
	default_states: {
		re_power_type: "always_on" | string;
		type: "last_states" | string;
		state: {
			brightness: number;
			color_temp: number;
			hue: number;
			saturation: number;
		};
	};
	device_id: string;
	device_on: boolean;
	dynamic_light_effect_enable: boolean;
	fw_id: string;
	fw_ver: string;
	has_set_location_info: boolean;
	hue: number;
	hw_id: string;
	hw_ver: string;
	ip: string;
	lang: string;
	latitude: number;
	longitude: number;
	mac: string;
	model: string;
	nickname: string;
	oem_id: string;
	overheated: boolean;
	region: string;
	rssi: number;
	saturation: number;
	signal_level: number;
	specs: string;
	ssid: string;
	time_diff: number;
	type: string;
};
