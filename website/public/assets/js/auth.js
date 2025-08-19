const account = {};

async function getAccount() {
	return new Promise(async (resolve, reject) => {
		try {
			setTimeout(() => {
				reject();
				return;
			}, 4000);

			const token = localStorage.getItem("token");

			const response = await sendRequest("/auth/verify", "POST", {
				body: JSON.stringify({
					token,
				}),
			});

			resolve();

			if (validJSON(response)) {
				const parsed = JSON.parse(response);
				if (parsed.valid === true) {
					Object.assign(account, {
						username: parsed.username,
					});
				}
			}
		} catch (error) {
			console.log(error);
			reject();
		}
	});
}

(async () => {
	if (!document.cookie.includes("token")) {
		localStorage.removeItem("token");
	}

	if (localStorage.getItem("token")) {
		await getAccount();
	}
})();
