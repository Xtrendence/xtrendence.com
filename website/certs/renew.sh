# Manual Command: sudo certbot certonly --manual

sudo certbot --webroot certonly --force-renew -d xtrendence.com,www.xtrendence.com --post-hook "/home/xtrendence/Documents/website/certs/move.sh";
sh /home/xtrendence/Documents/website/start.sh;

echo "$(date +"%m-%d %r") - Renewed Certificate" > "/home/xtrendence/Documents/website/certs/cert.log";