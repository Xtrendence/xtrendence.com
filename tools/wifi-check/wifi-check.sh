#!/bin/bash

MY_PATH="`dirname \"$0\"`"
LOG_PATH="`( cd \"$MY_PATH\" && cd .. && pwd )`/wifi-check/network.log"
now=$(date +"%m-%d %r")

array[0]="1.1.1.1"
array[1]="1.0.0.1"
array[2]="8.8.8.8"
array[3]="8.8.4.4"
array[4]="9.9.9.9"

size=${#array[@]}
index=$(($RANDOM % $size))
pingip=${array[$index]}

wlan='wlan0'

maxsize=1000
actualsize=$(du -k "$LOG_PATH" | cut -f1)
if [ $actualsize -ge $maxsize ]; then
		echo "" > $LOG_PATH
fi

# Perform the network check and reset if necessary
/bin/ping -c 2 -I $wlan $pingip > /dev/null 2> /dev/null
if [ $? -ge 1 ] ; then
    echo "$now - Network is down - (used $pingip) - Resetting..." >> $LOG_PATH
    /sbin/ifdown $wlan
    sleep 5
    /sbin/ifup --force $wlan
else
    echo "$now - Network is up - (used $pingip)" >> $LOG_PATH
fi