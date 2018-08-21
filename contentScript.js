const startPoint = {y: 0, x: 0};
let scrollLeft;
let scrollTop;

function preventDefaultEventHandler(event) {
	event.preventDefault();
	event.stopPropagation();
}

function removeNonTextContents(tables) {
	tables.forEach(table => {
		const elements = table.querySelectorAll("td, th");

		elements.forEach(element => {
			element.innerHTML = element.textContent;
		});
	});

	return tables;
}

function removeAttributes(tables) {
	tables.forEach(table => {
		const elements = table.querySelectorAll("*");
		const tableAttributes = table.getAttributeNames();

		tableAttributes.forEach(tattr => {
			table.removeAttribute(tattr);
		});

		elements.forEach(element => {
			const attributes = element.getAttributeNames();

			attributes.forEach(attr => {
				if (attr.includes("span")) { return; }
				element.removeAttribute(attr);
			});
		});
	});

	return tables;
}

function removeUnusedContents(table) {
	const clones = [];

	if (table.length) {
		table.forEach(t => {
			clones.push(t.cloneNode(true));
		});
	} else if (table) {
		clones.push(table.cloneNode(true));
	}

	return removeNonTextContents(removeAttributes(clones));
}

function getTableFromTableElement(el) {
	let table = el;

	while (table && table.tagName !== "TABLE") {
		if (table === document.body || table === document.documentElement) {
			return null;
		}
		table = table.parentNode;
	}

	return table;
}

function getPointedTable(x, y) {
	return getTableFromTableElement(document.elementFromPoint(x, y));
}

function requestHandleCapturedTable(tableElements) {
	let data = "";
	const tables = removeUnusedContents(tableElements);

	tables.forEach(t => { data += t.outerHTML; });

	if (!data) { return; }

	whale.storage.local.set({
		tableData: data,
	}, () => {
		whale.storage.local.get("resultHandlingType", items => {
			const resultType = items.resultHandlingType || "edit";

			whale.runtime.sendMessage({
				msg: "resultHandling",
				type: resultType,
			});
		});
	});
}

function checkRectInRange(rect, range) {
	return (
		(rect.left >= range.left) &&
		(rect.right <= range.right) &&
		(rect.top >= range.top) &&
		(rect.bottom <= range.bottom)
	);
}

function endCapture() {
	whale.runtime.sendMessage({
		msg: "endCapture",
	});
}

function paintPointedTable(event) {
	function offset(el) {
		const rect = el.getBoundingClientRect();

		scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
		scrollTop = window.pageYOffset || document.documentElement.scrollTop;

		return {top: rect.top + scrollTop, left: rect.left + scrollLeft};
	}

	const table = getPointedTable(event.clientX, event.clientY);
	const effect = document.querySelector("#hover-effect");

	if (!table) {
		effect.classList.add("hide");
		return;
	}

	const tableOffset = offset(table);

	effect.style.width = `${table.offsetWidth}px`;
	effect.style.height = `${table.offsetHeight}px`;
	effect.style.top = `${tableOffset.top}px`;
	effect.style.left = `${tableOffset.left}px`;
	effect.classList.remove("hide");
}

function getSelectedElements(event) {
	const table = getPointedTable(event.clientX, event.clientY);
	const effect = document.querySelector("#hover-effect");

	window.removeEventListener("mouseover", paintPointedTable);
	effect.classList.add("hide");
	endCapture();

	if (table) { requestHandleCapturedTable(table); }
}

function clearOutRangedElements(table, rect) {
	const clone = table.cloneNode(false);
	let hasContents = false;

	if (!table.hasChildNodes()) { return null; }

	table.childNodes.forEach(child => {
		if (child.nodeType === 1) {
			if (child.firstElementChild) {
				const cleanChild = clearOutRangedElements(child, rect);

				if (cleanChild) {
					clone.appendChild(cleanChild);
					hasContents = true;
				}
			} else if (checkRectInRange(table.getBoundingClientRect(), rect) ||
				checkRectInRange(child.getBoundingClientRect(), rect)) {
				clone.appendChild(child.cloneNode(true));
				hasContents = true;
			}
		}
	});

	if (!hasContents) {
		return null;
	}

	return clone;
}

function getTableElementsInRange(rect) {
	const tables = document.querySelectorAll("table");
	const results = [];

	tables.forEach(table => {
		const cleanTable = clearOutRangedElements(table, rect);

		if (cleanTable) { results.push(cleanTable); }
	});

	return results;
}

function viewDragRanged(event) {
	const effect = document.querySelector("#hover-effect");
	const x = event.clientX + scrollLeft;
	const y = event.clientY + scrollTop;

	if (x > startPoint.x) {
		effect.style.width = `${x - startPoint.x}px`;
		effect.style.left = `${startPoint.x}px`;
	} else {
		effect.style.width = `${startPoint.x - x}px`;
		effect.style.left = `${x}px`;
	}

	if (y > startPoint.y) {
		effect.style.height = `${y - startPoint.y}px`;
		effect.style.top = `${startPoint.y}px`;
	} else {
		effect.style.height = `${startPoint.y - y}px`;
		effect.style.top = `${y}px`;
	}
}

function endSelectRangedElements() {
	const effect = document.querySelector("#hover-effect");
	const rect = effect.getBoundingClientRect();

	effect.classList.add("hide");
	window.removeEventListener("selectstart", preventDefaultEventHandler);
	window.removeEventListener("mousemove", viewDragRanged);
	endCapture();

	const tables = getTableElementsInRange(rect);

	if (tables.length) { requestHandleCapturedTable(tables); }
}

function startSelectRangedElements(event) {
	const effect = document.querySelector("#hover-effect");

	startPoint.x = event.clientX + scrollLeft;
	startPoint.y = event.clientY + scrollTop;

	effect.style.width = "0px";
	effect.style.height = "0px";
	effect.style.top = `${startPoint.y}px`;
	effect.style.left = `${startPoint.x}px`;
	effect.classList.remove("hide");

	window.addEventListener("selectstart", preventDefaultEventHandler);
	window.addEventListener("mousemove", viewDragRanged);
	window.addEventListener("mouseup", endSelectRangedElements, {once: true});
}

function selectRangedTableElements() {
	startPoint.x = 0;
	startPoint.y = 0;
	scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
	scrollTop = window.pageYOffset || document.documentElement.scrollTop;

	if (!document.querySelector("#hover-effect")) {
		document.body.insertAdjacentHTML("beforeend", '<div id="hover-effect" class="picked-effect"></div>');
	}
	window.addEventListener("mousedown", startSelectRangedElements, {once: true});
}

function selectTable() {
	if (!document.querySelector("#hover-effect")) {
		document.body.insertAdjacentHTML("beforeend", '<div id="hover-effect" class="picked-effect"></div>');
	}

	window.addEventListener("mouseover", paintPointedTable);
	window.addEventListener("click", getSelectedElements, {once: true});
}

const CAPTURE = {
	"cursor-select-mode": selectRangedTableElements,
	"element-select-mode": selectTable,
};

window.addEventListener("keydown", event => {
	if (event.key === "Escape") {
		const effect = document.querySelector("#hover-effect");

		// element-select-mode
		window.removeEventListener("mouseover", paintPointedTable);
		window.removeEventListener("click", getSelectedElements);

		// cursor-select-mode
		window.removeEventListener("mousedown", startSelectRangedElements);
		window.removeEventListener("selectstart", preventDefaultEventHandler);
		window.removeEventListener("mousemove", viewDragRanged);
		window.removeEventListener("mouseup", endSelectRangedElements);

		effect.classList.add("hide");
		endCapture();
	}
});

/**
 *  @param message
 *  {
 *    msg: "startCapture",
 *    type: (string),
 *  }
 *
 *  type
 *  - "cursor-select-mode"
 *  - "element-select-mode"
 */
whale.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.msg === "startCapture") {
		const captureMethod = CAPTURE[message.type];
		const success = typeof captureMethod === "function";

		sendResponse(success);

		if (success) { captureMethod(); }
	}
});
