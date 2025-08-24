export type TLight = {
  id: string;
  created_at: string;
  updated_at: string;
  mac: string;
  ip: string;
  name: string;
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
