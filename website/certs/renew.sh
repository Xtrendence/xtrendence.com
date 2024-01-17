sudo certbot --webroot certonly --force-renew -d xtrendence.com,www.xtrendence.com --post-hook "/home/pi/Documents/website/certs/move.sh";
sh /home/pi/Documents/website/start.sh;

echo "$(date +"%m-%d %r") - Renewed Certificate" > "/home/pi/Documents/website/certs/cert.log";