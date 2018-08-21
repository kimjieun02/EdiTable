document
	.querySelector("#mode-select-buttons")
	.addEventListener("click", event => {
		if (event.target.tagName !== "BUTTON") { return; }

		const mode = event.target.id;

		whale.tabs.query({active: true}, tabs => {
			whale.tabs.sendMessage(tabs[0].id, {
				msg: "startCapture",
				type: mode,
			}, success => {
				if (success) {
					whale.browserAction.setBadgeText({text: "capture"});
					window.close();
				}
			});
		});
	});

document
	.querySelector("#handling-result-select-radios")
	.addEventListener("click", event => {
		const selectedHandlingMethod = event.currentTarget.querySelector("input[type=radio]:checked").value;

		whale.storage.local.set({resultHandlingType: selectedHandlingMethod});
	});

window.addEventListener("load", () => {
	whale.storage.local.get("resultHandlingType", items => {
		if (items.resultHandlingType) {
			document.querySelector(`#handling-result-select-radios input[value=${items.resultHandlingType}]`).checked = true;
		}
	});
});
