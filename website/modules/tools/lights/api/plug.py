# Usage: plug.py state|on|off IP, plug.py restart IP SECONDS, or plug.py energy IP QUARTERS

import resource

# A crash dump would hold the account details from the environment, so none is ever written
resource.setrlimit(resource.RLIMIT_CORE, (0, 0))

import asyncio
from datetime import date, timedelta, timezone
import json
import os
import sys

from tapo import ApiClient
from tapo.requests import EnergyDataInterval
from tapo.responses import PowerState


def millis(moment):
    # The plug reports UTC, sometimes without saying so
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return int(moment.timestamp() * 1000)


def entries(result):
    return [[millis(entry.start_date_time), entry.energy] for entry in result.entries if entry.energy is not None]


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
    elif command == "off":
        # A pending restart timer would switch it back on, so it goes first
        await plug.clear_timer()
        report(step="cleared")
        await plug.off()
        report(step="off")
    elif command == "energy":
        quarters = int(sys.argv[3]) if len(sys.argv) > 3 else 1
        usage = await plug.get_energy_usage()
        report(kind="usage", power=usage.current_power, today=usage.today_energy, month=usage.month_energy)
        today = date.today()
        hourly = await plug.get_energy_data(EnergyDataInterval.Hourly, today - timedelta(days=7), today)
        report(kind="hourly", entries=entries(hourly))
        start = date(today.year, 3 * ((today.month - 1) // 3) + 1, 1)
        for _ in range(quarters):
            daily = await plug.get_energy_data(EnergyDataInterval.Daily, start)
            report(kind="daily", entries=entries(daily))
            start = date(start.year - 1, 10, 1) if start.month == 1 else date(start.year, start.month - 3, 1)
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
