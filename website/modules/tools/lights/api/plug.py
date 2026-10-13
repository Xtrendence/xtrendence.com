# Usage: plug.py state|on IP, or plug.py restart IP SECONDS

import asyncio
import json
import os
import sys

from tapo import ApiClient
from tapo.responses import PowerState


def report(**values):
    print(json.dumps(values), flush=True)


async def main():
    command, ip = sys.argv[1], sys.argv[2]
    client = ApiClient(os.environ["TP_EMAIL"], os.environ["TP_PASSWORD"])
    plug = await client.p110(ip)

    if command == "state":
        info = (await plug.get_device_info()).to_dict()
        report(on=info.get("device_on"))
    elif command == "on":
        await plug.on()
        report(step="on")
    elif command == "restart":
        seconds = int(sys.argv[3])
        # Timer first, while the network is still up
        await plug.set_timer(seconds, PowerState.On)
        report(step="timer")
        await plug.off()
        report(step="off")
    else:
        raise ValueError(f"Unknown command {command}")


try:
    asyncio.run(main())
except Exception as error:
    report(error=str(error))
    sys.exit(1)
