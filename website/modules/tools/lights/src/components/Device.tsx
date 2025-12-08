import { Button, Card, Slider } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { isNullish } from "remeda";
import { useDebounceCallback, useWindowSize } from "usehooks-ts";
import type { TLight } from "../../shared/types";
import { BULB_COLORS, getColorByHueAndSaturation, useBulb } from "../hooks/useBulb";
import { useDevice } from "../hooks/useDevices";

const marks = [
  { value: 0, label: "0%" },
  { value: 50, label: "50%" },
  { value: 100, label: "100%" },
];

export function Device({ light }: { light: TLight }) {
  const { width } = useWindowSize();

  const bulb = useBulb();
  const device = useDevice(light.id).data;

  const [brightness, setBrightness] = useState<number>(0);
  const [disableBrightness, setDisableBrightness] = useState<boolean>(false);

  useEffect(() => {
    if (device?.brightness) {
      setBrightness(device.brightness);
    }
  }, [device?.brightness]);

  const updateBrightness = useDebounceCallback((value: number[]) => {
    if (value?.[0]) {
      setDisableBrightness(true);
      bulb.brightness(light.id, value[0]);
      setTimeout(() => setDisableBrightness(false), 3000);
    }
  }, 1000);

  return (
    <Card.Root
      key={light.id}
      className="bg-black/80"
      style={{
        minWidth: "300px",
        maxWidth: "500px",
        width:
          width < 640
            ? "calc(50dvw - 20px)"
            : width < 1280
              ? "calc(33% - 7px)"
              : "calc(25% - 12px - 8px)",
      }}
    >
      <Card.Header className="text-lg font-bold">{light.name}</Card.Header>
      <Card.Body className="flex flex-col gap-4">
        <div className="flex gap-2 justify-between">
          <div className="flex gap-4">
            <div className="flex flex-col gap-2">
              <Button
                colorPalette={"gray"}
                variant="surface"
                className="w-20"
                disabled={device?.device_on || isNullish(device?.device_on)}
                onClick={() => {
                  bulb.on(light.id);
                }}
              >
                On
              </Button>
              <Button
                colorPalette={"blue"}
                variant="surface"
                className="w-20"
                disabled={
                  isNullish(device?.device_on) ||
                  getColorByHueAndSaturation(device?.hue ?? 0, device?.saturation ?? 0) === "blue"
                }
                onClick={() => {
                  bulb.color(light.id, BULB_COLORS.blue.hex);
                }}
              >
                Blue
              </Button>
              <Button
                colorPalette={"green"}
                variant="surface"
                className="w-20"
                disabled={
                  isNullish(device?.device_on) ||
                  getColorByHueAndSaturation(device?.hue ?? 0, device?.saturation ?? 0) === "green"
                }
                onClick={() => {
                  bulb.color(light.id, BULB_COLORS.green.hex);
                }}
              >
                Green
              </Button>
              <Button
                colorPalette={"orange"}
                variant="surface"
                className="w-20"
                disabled={
                  isNullish(device?.device_on) ||
                  getColorByHueAndSaturation(device?.hue ?? 0, device?.saturation ?? 0) === "orange"
                }
                onClick={() => {
                  bulb.color(light.id, BULB_COLORS.orange.hex);
                }}
              >
                Orange
              </Button>
              <Button
                colorPalette={"yellow"}
                variant="surface"
                className="w-20"
                disabled={
                  isNullish(device?.device_on) ||
                  getColorByHueAndSaturation(device?.hue ?? 0, device?.saturation ?? 0) === "yellow"
                }
                onClick={() => {
                  bulb.color(light.id, BULB_COLORS.yellow.hex);
                }}
              >
                Yellow
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                colorPalette={"gray"}
                variant="surface"
                className="w-20"
                disabled={!device?.device_on || isNullish(device?.device_on)}
                onClick={() => {
                  bulb.off(light.id);
                }}
              >
                Off
              </Button>
              <Button
                colorPalette={"red"}
                variant="surface"
                className="w-20"
                disabled={
                  isNullish(device?.device_on) ||
                  getColorByHueAndSaturation(device?.hue ?? 0, device?.saturation ?? 0) === "red"
                }
                onClick={() => {
                  bulb.color(light.id, BULB_COLORS.red.hex);
                }}
              >
                Red
              </Button>
              <Button
                colorPalette={"purple"}
                variant="surface"
                className="w-20"
                disabled={
                  isNullish(device?.device_on) ||
                  getColorByHueAndSaturation(device?.hue ?? 0, device?.saturation ?? 0) === "purple"
                }
                onClick={() => {
                  bulb.color(light.id, BULB_COLORS.purple.hex);
                }}
              >
                Purple
              </Button>
              <Button
                colorPalette={"white"}
                variant="solid"
                className="w-20"
                disabled={
                  isNullish(device?.device_on) ||
                  getColorByHueAndSaturation(device?.hue ?? 0, device?.saturation ?? 0) === "white"
                }
                onClick={() => {
                  bulb.color(light.id, BULB_COLORS.white.hex);
                }}
              >
                White
              </Button>
              <Button
                colorPalette={"pink"}
                variant="solid"
                className="w-20"
                disabled={
                  isNullish(device?.device_on) ||
                  getColorByHueAndSaturation(device?.hue ?? 0, device?.saturation ?? 0) === "pink"
                }
                onClick={() => {
                  bulb.color(light.id, BULB_COLORS.pink.hex);
                }}
              >
                Pink
              </Button>
            </div>
          </div>
          <div>
            <Slider.Root
              className="h-full mx-4"
              orientation="vertical"
              colorPalette="white"
              min={1}
              max={100}
              disabled={disableBrightness || isNullish(device?.device_on)}
              value={[brightness]}
              onValueChange={({ value }) => {
                setBrightness(value[0]);
              }}
              onValueChangeEnd={({ value }) => {
                updateBrightness([value[0]]);
              }}
            >
              <Slider.Control>
                <Slider.Track>
                  <Slider.Range />
                </Slider.Track>
                <Slider.Thumbs />
                <Slider.Marks marks={marks} />
              </Slider.Control>
            </Slider.Root>
          </div>
        </div>
      </Card.Body>
    </Card.Root>
  );
}
