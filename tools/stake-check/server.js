import fetch from "node-fetch"
import KrakenClient from 'kraken-api';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const key = "***REMOVED***";
const secret = "***REMOVED***";

const kraken = new KrakenClient(key, secret);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let previousFile = path.join(__dirname, "./previous.txt");

if(!fs.existsSync(previousFile)) {
	fs.writeFileSync(previousFile, "0");
}

kraken.api("Balance").then(balance => {
	try {
		let previous = parseFloat(fs.readFileSync(previousFile, { encoding:"utf-8" }));
		let current = parseFloat(balance.result["DOT.S"]);

		if(previous !== current) {
			fs.writeFile(previousFile, current.toString(), error => {
				if(error) {
					console.log(error);
				} else {
					let amount = (current - previous).toFixed(2).toString();
					
					console.log(amount);

					let url = "https://www.xtrendence.com/bot/scripts/api.php?action=send-notification&key=***REMOVED***&title=Staking+Reward&text=You%27ve+been+rewarded+with+" + amount + "+DOT.";

					fetch(url, {
						method: "GET",
					})
					.then((text) => {
						return text.text();
					})
					.then((response) => {
						console.log(response);
					})
					.catch(error => {
						console.log(error);
					});
				}
			});
		}
	} catch(error) {
		console.log(error);
	}
}).catch(error => {
	console.log(error);
});