const nav = document.querySelector("#tool-bar nav");
const toolBar = document.querySelector("#tool-bar");

let cnt = 0;
let editTarget = null;
let isSelecting = false;
let prevText = "";

let myClipBoard = null;
const historySize = 10;
const dataHistory = [];

function preventDefaultEventHandler(event) {
	event.preventDefault();
	event.stopPropagation();
}

function htmlToElement(html) {
	const template = document.createElement("template");

	template.innerHTML = html.trim();
	return template.content.firstChild;
}

// TODO: selected data visualization
function visualizeData(data) {

}

function openNthSheet(n) {
	const viewedSheet = document.querySelector(".sheet:not(.hide)");
	const selectedButton = nav.querySelector("button.selected");

	const sheet = document.querySelector(`.sheet[data-index="${n}"]`);
	const navButton = nav.querySelector(`button[data-index="${n}"]`);

	if (sheet && navButton) {
		sheet.classList.remove("hide");
		navButton.classList.add("selected");
	} else {
		return;
	}

	if (viewedSheet !== sheet && viewedSheet && selectedButton) {
		viewedSheet.classList.add("hide");
		selectedButton.classList.remove("selected");
	}
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

function formatTable(tableHTML) {
	const table = htmlToElement(tableHTML);
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

	const rows = table.rows;

	const defaultColNum = 50;
	const defaultRowNum = 50;
	let colNum = 0;

	for (let i = 0; i < rows.length; ++i) {
		const row = rows[i];
		let j = 0;

		while (j < row.cells.length) {
			const cell = row.cells[j];
			let fakeCells = "";

			for (let k = 1; k < cell.colSpan; ++k) {
				fakeCells += `<td class="fake-cell" row="${i + 1}" col="${j + 1}"></td>`;
			}
			cell.insertAdjacentHTML("afterend", fakeCells);
			fakeCells += `<td class="fake-cell" row="${i + 1}" col="${j + 1}"></td>`;

			for (let k = 1; k < cell.rowSpan; ++k) {
				if (!rows[i + k]) { break; }

				if (rows[i + k].cells.length > j) {
					const nextCell = rows[i + k].cells[j];

					nextCell.insertAdjacentHTML("beforebegin", fakeCells);
				} else {
					const lastCell = rows[i + k].cells[rows[i + k].cells.length - 1];

					lastCell.insertAdjacentHTML("afterend", fakeCells);
				}
			}
			j += cell.colSpan;
		}
		colNum = Math.max(row.cells.length, colNum);
	}

	colNum = Math.max(colNum, defaultColNum);

	for (let i = 0; i < rows.length; ++i) {
		const row = rows[i];

		for (let j = row.cells.length; j < colNum; ++j) {
			row.insertCell(-1);
		}
	}

	for (let i = rows.length; i < defaultRowNum; ++i) {
		const row = table.insertRow(-1);

		for (let j = 0; j < colNum; ++j) {
			row.insertCell(-1);
		}
	}

	const headerRow = table.insertRow(0);

	headerRow.insertAdjacentHTML("beforeend", `<th class="table-header"></th>`);
	for (let i = 0; i < Math.max(defaultColNum, colNum); ++i) {
		let index = "";
		let j = i;

		do {
			index = alphabet[j % alphabet.length] + index;
			j = Math.floor(j / alphabet.length) - 1;
		} while (j >= 0);

		headerRow.insertAdjacentHTML("beforeend", `<th class="table-header">${index}</th>`);
	}

	for (let i = 1; i < table.rows.length; ++i) {
		const row = table.rows[i];

		row.insertAdjacentHTML("afterbegin", `<th class="table-header">${i}</th>`);
	}

	table.setAttribute("spellcheck", false);

	return table.outerHTML;
}

function addSheet(tableHTML) {
	function format(s, c) {
		return s.replace(/{(\w+)}/g, (m, p) => c[p]);
	}

	const tmplSheet =
		"<div class=\"sheet hide\" data-index=\"{idx}\">" +
			"{table}" +
		"</div>";

	const tmplNavButton =
		"<button data-index=\"{idx}\">" +
			"Sheet{idx}" +
		"</button>";

	const newSheet = format(tmplSheet, {table: formatTable(tableHTML), idx: cnt});
	const navButton = format(tmplNavButton, {idx: cnt});

	toolBar.insertAdjacentHTML("beforebegin", newSheet);
	nav.insertAdjacentHTML("beforeend", navButton);

	openNthSheet(cnt++);
}

function getRangeVertex() {
	const table = document.querySelector(".sheet:not(.hide) table");
	const effect = document.querySelector("#select-effect");
	const effectRect = effect.getBoundingClientRect();

	const leftTop = document.elementFromPoint(effectRect.left + 40, effectRect.top + 7);
	const rightBottom = document.elementFromPoint(effectRect.right - 40, effectRect.bottom - 7);

	return {
		start: {
			row: Array.from(table.rows).indexOf(leftTop.parentElement),
			col: Array.from(leftTop.parentElement.cells).indexOf(leftTop),
		},
		end: {
			row: Array.from(table.rows).indexOf(rightBottom.parentElement),
			col: Array.from(rightBottom.parentElement.cells).indexOf(rightBottom),
		},
	};
}

function getTableElementsInRange(removeOriginal) {
	const table = document.querySelector(".sheet:not(.hide) table");

	const elements = [];
	const v = getRangeVertex();

	for (let i = v.start.row; i <= v.end.row; ++i) {
		const row = table.rows[i];
		const tr = [];

		for (let j = v.start.col; j <= v.end.col; ++j) {
			const cell = row.cells[j];

			tr.push(cell);
			if (removeOriginal) {
				row.replaceChild(cell.cloneNode(false), cell);
			}
		}
		elements.push(tr);
	}

	return elements;
}

nav.addEventListener("click", event => {
	const idx = event.target.dataset.index;

	if (idx) {
		openNthSheet(idx);
	}
});

function saveData() {
	const tables = document.querySelectorAll(".sheet table");
	const clonedTables = Array.from(tables).map(t => t.cloneNode(true));

	clonedTables.forEach(t => {
		t.deleteRow(0);
		let emptyRows = [];

		for (let i = 0; i < t.rows.length; ++i) {
			const row = t.rows[i];
			const fakeCells = [];
			let tmp = [];
			let hasContents = false;

			row.deleteCell(0);
			for (let j = 0; j < row.cells.length; ++j) {
				const cell = row.cells[j];

				if (cell.classList.contains("fake-cell")) {
					fakeCells.push(cell);
					continue;
				}

				if (cell.textContent) {
					tmp = [];
					hasContents = true;
				} else {
					tmp.push(cell);
				}
			}

			if (!hasContents) {
				emptyRows.push(row);
				continue;
			} else {
				emptyRows = [];
			}

			tmp.forEach(emptyCell => {
				row.removeChild(emptyCell);
			});

			fakeCells.forEach(fakeCell => {
				row.removeChild(fakeCell);
			});
		}

		emptyRows.forEach(emptyRow => {
			emptyRow.parentNode.removeChild(emptyRow);
		});
	});

	const cleanTables = removeAttributes(clonedTables);
	let data = "";

	cleanTables.forEach(t => { data += t.outerHTML; });

	if (!data) { return; }

	whale.storage.local.set({
		tableData: data,
	});
}

document.querySelector("#export-btn-container").addEventListener("click", event => {
	const type = event.target.getAttribute("ftype");

	if (!type) { return; }

	saveData();

	whale.runtime.sendMessage({
		msg: "resultHandling",
		type: `download-${type}`,
	});
});

const selectPos = {
	start: null,
	end: null,
};

function paintCells(pos) {
	const effect = document.querySelector("#select-effect");
	const sheet = effect.parentNode;

	const scrollLeft = sheet.scrollLeft;
	const scrollTop = sheet.scrollTop;

	const startRect = pos.start.getBoundingClientRect();
	const endRect = pos.end.getBoundingClientRect();
	const sheetRect = sheet.getBoundingClientRect();

	const rect = {
		top: 0,
		left: 0,
		width: 0,
		height: 0,
	};

	if (startRect.left < endRect.left) {
		rect.left = startRect.left + scrollLeft - sheetRect.left;
		rect.width = endRect.left - startRect.left + endRect.width;
	} else {
		rect.left = endRect.left + scrollLeft - sheetRect.left;
		rect.width = startRect.left - endRect.left + startRect.width;
	}

	if (startRect.top < endRect.top) {
		rect.top = startRect.top + scrollTop - sheetRect.top;
		rect.height = endRect.top - startRect.top + endRect.height;
	} else {
		rect.top = endRect.top + scrollTop - sheetRect.top;
		rect.height = startRect.top - endRect.top + startRect.height;
	}

	// TODO: paint cell
	effect.style.width = `${rect.width}px`;
	effect.style.height = `${rect.height}px`;
	effect.style.top = `${rect.top}px`;
	effect.style.left = `${rect.left}px`;
	effect.classList.remove("hide");

	if (endRect.left < sheetRect.left) {
		sheet.scrollTo({
			left: sheet.scrollLeft + (endRect.left - sheetRect.left) - 25,
		});
	} else if (endRect.right > sheetRect.right) {
		sheet.scrollTo({
			left: sheet.scrollLeft + (endRect.right - sheetRect.right) + 25,
		});
	}

	if (endRect.top < sheetRect.top) {
		sheet.scrollTo({
			top: sheet.scrollTop + (endRect.top - sheetRect.top) - 25,
		});
	} else if (endRect.bottom > sheetRect.bottom) {
		sheet.scrollTo({
			top: sheet.scrollTop + (endRect.bottom - sheetRect.bottom) + 25,
		});
	}
}

function displaySelectedRange(event) {
	const target = document.elementFromPoint(event.clientX, event.clientY);

	if (target) {
		if ((target.tagName === "TH" && !target.classList.contains("table-header")) ||
				target.tagName === "TD") {
			selectPos.end = target;
		}
	}
	paintCells(selectPos);
}

window.addEventListener("mousedown", event => {
	const effect = document.querySelector("#select-effect");
	const sheet = document.querySelector(".sheet:not(.hide)");
	const table = sheet.querySelector("table");
	const selection = window.getSelection();

	if (event.target !== editTarget && selection && selection.rangeCount > 0) {
		selection.getRangeAt(0).collapse(true);
	}

	if ((event.target.tagName === "TH" && !event.target.classList.contains("table-header")) ||
			event.target.tagName === "TD") {
		if (event.target === editTarget) {
			return;
		} else if (editTarget) {
			const startRow = Array.from(table.rows).indexOf(editTarget.parentElement);
			const startCol = Array.from(editTarget.parentElement.cells).indexOf(editTarget);

			const prevData = editTarget.cloneNode(false);

			prevData.textContent = prevText;
			editTarget.setAttribute("contenteditable", false);

			if (dataHistory.length >= historySize) { dataHistory.shift(); }
			dataHistory.push({
				sheetNum: table.parentElement.dataset.index,
				data: {
					pos: {row: startRow, col: startCol},
					cellData: [[prevData]],
				},
			});

			editTarget = null;
			prevText = "";
		}
		sheet.appendChild(effect);
		effect.classList.remove("hide");

		selectPos.start = event.target;
		selectPos.end = selectPos.start;
		paintCells(selectPos);

		isSelecting = true;

		window.addEventListener("selectstart", preventDefaultEventHandler);
		window.addEventListener("mousemove", displaySelectedRange);
	} else if (editTarget) {
		const startRow = Array.from(table.rows).indexOf(editTarget.parentElement);
		const startCol = Array.from(editTarget.parentElement.cells).indexOf(editTarget);

		const prevData = editTarget.cloneNode(false);

		prevData.textContent = prevText;
		editTarget.setAttribute("contenteditable", false);

		if (dataHistory.length >= historySize) { dataHistory.shift(); }
		dataHistory.push({
			sheetNum: table.parentElement.dataset.index,
			data: {
				pos: {row: startRow, col: startCol},
				cellData: [[prevData]],
			},
		});

		editTarget = null;
		prevText = "";
	}
});

window.addEventListener("mouseup", event => {
	window.removeEventListener("selectstart", preventDefaultEventHandler);
	window.removeEventListener("mousemove", displaySelectedRange);

	if (!isSelecting) { return; }

	if ((event.target.tagName === "TH" && !event.target.classList.contains("table-header")) ||
		event.target.tagName === "TD") {
		selectPos.end = event.target;
		paintCells(selectPos);
	}

	isSelecting = false;
});

window.addEventListener("keydown", event => {
	const table = document.querySelector(".sheet:not(.hide) table");
	const effect = document.querySelector("#select-effect");
	const effectRect = effect.getBoundingClientRect();

	if (event.key === "Tab" || (event.key === "ArrowRight" && !editTarget)) {
		preventDefaultEventHandler(event);

		if (editTarget) {
			const startRow = Array.from(table.rows).indexOf(editTarget.parentElement);
			const startCol = Array.from(editTarget.parentElement.cells).indexOf(editTarget);

			const prevData = editTarget.cloneNode(false);

			prevData.textContent = prevText;
			editTarget.setAttribute("contenteditable", false);

			if (dataHistory.length >= historySize) { dataHistory.shift(); }
			dataHistory.push({
				sheetNum: table.parentElement.dataset.index,
				data: {
					pos: {row: startRow, col: startCol},
					cellData: [[prevData]],
				},
			});

			editTarget = null;
			prevText = "";
		}

		if (selectPos.start) {
			let nextElement = selectPos.start.nextElementSibling;

			if (!nextElement) { return; }
			while (nextElement.classList.contains("fake-cell")) {
				nextElement = nextElement.nextElementSibling;
				if (!nextElement) { return; }
			}

			selectPos.start = nextElement;
			selectPos.end = selectPos.start;
			paintCells(selectPos);
		}
	} else if (event.key === "ArrowLeft" && !editTarget) {
		preventDefaultEventHandler(event);

		if (selectPos.start) {
			let prevElement = selectPos.start.previousElementSibling;

			if (prevElement.classList.contains("table-header")) { return; }
			if (prevElement.classList.contains("fake-cell")) {
				const row = prevElement.getAttribute("row");
				const col = prevElement.getAttribute("col");

				prevElement = table.rows[row].cells[col];
			}

			selectPos.start = prevElement;
			selectPos.end = selectPos.start;
			paintCells(selectPos);
		}
	} else if (event.key === "ArrowUp") {
		preventDefaultEventHandler(event);

		if (editTarget) {
			const startRow = Array.from(table.rows).indexOf(editTarget.parentElement);
			const startCol = Array.from(editTarget.parentElement.cells).indexOf(editTarget);

			const prevData = editTarget.cloneNode(false);

			prevData.textContent = prevText;
			editTarget.setAttribute("contenteditable", false);

			if (dataHistory.length >= historySize) { dataHistory.shift(); }
			dataHistory.push({
				sheetNum: table.parentElement.dataset.index,
				data: {
					pos: {row: startRow, col: startCol},
					cellData: [[prevData]],
				},
			});

			editTarget = null;
			prevText = "";
		}

		if (selectPos.start) {
			let row = Array.from(table.rows).indexOf(selectPos.start.parentElement) - 1;
			let col = Array.from(selectPos.start.parentNode.children).indexOf(selectPos.start);
			let prevElement = table.rows[row].cells[col];

			if (prevElement.classList.contains("table-header")) { return; }
			if (prevElement.classList.contains("fake-cell")) {
				row = prevElement.getAttribute("row");
				col = prevElement.getAttribute("col");

				prevElement = table.rows[row].cells[col];
			}

			selectPos.start = prevElement;
			selectPos.end = selectPos.start;
			paintCells(selectPos);
		}
	} else if (event.key === "ArrowDown") {
		preventDefaultEventHandler(event);

		if (editTarget) {
			const startRow = Array.from(table.rows).indexOf(editTarget.parentElement);
			const startCol = Array.from(editTarget.parentElement.cells).indexOf(editTarget);

			editTarget.setAttribute("contenteditable", false);

			if (dataHistory.length >= historySize) { dataHistory.shift(); }
			dataHistory.push({
				sheetNum: table.parentElement.dataset.index,
				data: {
					pos: {row: startRow, col: startCol},
					cellData: [[editTarget.cloneNode(true)]],
				},
			});

			editTarget = null;
			prevText = "";
		}

		if (selectPos.start) {
			let row = Array.from(table.rows).indexOf(selectPos.start.parentElement) + 1;
			const col = Array.from(selectPos.start.parentNode.children).indexOf(selectPos.start);

			if (table.rows.length <= row) { return; }

			let nextElement = table.rows[row].cells[col];

			while (nextElement.classList.contains("fake-cell")) {
				if (table.rows.length <= ++row) { return; }
				nextElement = table.rows[row].cells[col];
			}

			selectPos.start = nextElement;
			selectPos.end = selectPos.start;
			paintCells(selectPos);
		}
	} else if (event.key === "Delete" && !editTarget) {
		preventDefaultEventHandler(event);

		const elements = getTableElementsInRange(false);
		const prevData = [];

		const startTarget = document.elementFromPoint(effectRect.x + 40, effectRect.y + 7);
		const startRow = Array.from(table.rows).indexOf(startTarget.parentElement);
		const startCol = Array.from(startTarget.parentElement.cells).indexOf(startTarget);

		for (let i = 0; i < elements.length; ++i) {
			const row = elements[i];
			const prevRow = [];

			for (let j = 0; j < row.length; ++j) {
				prevRow.push(row[j].cloneNode(true));
				row[j].textContent = "";
			}
			prevData.push(prevRow);
		}

		if (dataHistory.length >= historySize) { dataHistory.shift(); }
		dataHistory.push({
			sheetNum: table.parentElement.dataset.index,
			data: {
				pos: {row: startRow, col: startCol},
				cellData: prevData,
			},
		});
	} else if (event.key === "Escape" && editTarget) {
		preventDefaultEventHandler(event);

		editTarget.setAttribute("contenteditable", false);
		editTarget.textContent = prevText;
		editTarget = null;
		prevText = "";
	} else if (event.key === "c" && event.ctrlKey && !editTarget) {
		preventDefaultEventHandler(event);
		myClipBoard = getTableElementsInRange(false);
	} else if (event.key === "x" && event.ctrlKey && !editTarget) {
		preventDefaultEventHandler(event);
		myClipBoard = getTableElementsInRange(true);

		if (myClipBoard.length) {
			const startTarget = document.elementFromPoint(effectRect.x + 40, effectRect.y + 7);
			const startRow = Array.from(table.rows).indexOf(startTarget.parentElement);
			const startCol = Array.from(startTarget.parentElement.cells).indexOf(startTarget);

			if (dataHistory.length >= historySize) { dataHistory.shift(); }
			dataHistory.push({
				sheetNum: table.parentElement.dataset.index,
				data: {
					pos: {row: startRow, col: startCol},
					cellData: myClipBoard,
				},
			});
		}
	} else if (event.key === "v" && event.ctrlKey && !editTarget) {
		preventDefaultEventHandler(event);

		const rowSize = myClipBoard.length;
		const colSize = myClipBoard[0].length;

		const startPoint = document.elementFromPoint(effectRect.x + 40, effectRect.y + 7);
		const startRow = Array.from(table.rows).indexOf(startPoint.parentElement);
		const startCol = Array.from(startPoint.parentElement.cells).indexOf(startPoint);

		const prevData = [];

		for (let i = 0; i < rowSize; ++i) {
			const row = table.rows[startRow + i];
			const prevRow = [];

			for (let j = 0; j < colSize; ++j) {
				const cell = row.cells[startCol + j];

				prevRow.push(cell);
				row.replaceChild(myClipBoard[i][j].cloneNode(true), cell);
			}
			prevData.push(prevRow);
		}

		if (dataHistory.length >= historySize) { dataHistory.shift(); }
		dataHistory.push({
			sheetNum: table.parentElement.dataset.index,
			data: {
				pos: {row: startRow, col: startCol},
				cellData: prevData,
			},
		});
	} else if (event.key === "z" && event.ctrlKey && !editTarget) {
		preventDefaultEventHandler(event);
		if (!dataHistory.length) { return; }

		const data = dataHistory.pop();
		const prevData = data.data.cellData;

		const rowSize = prevData.length;
		const colSize = prevData[0].length;
		const startRow = data.data.pos.row;
		const startCol = data.data.pos.col;

		const prevTable = document.querySelector(`.sheet[data-index="${data.sheetNum}"] table`);

		for (let i = 0; i < rowSize; ++i) {
			const row = prevTable.rows[startRow + i];

			for (let j = 0; j < colSize; ++j) {
				const cell = row.cells[startCol + j];

				row.replaceChild(prevData[i][j].cloneNode(true), cell);
			}
		}
		openNthSheet(data.sheetNum);
	}
});

window.addEventListener("keypress", event => {
	const table = document.querySelector(".sheet:not(.hide) table");

	if (event.key === "Enter") {
		preventDefaultEventHandler(event);

		if (editTarget) {
			const startRow = Array.from(table.rows).indexOf(editTarget.parentElement);
			const startCol = Array.from(editTarget.parentElement.cells).indexOf(editTarget);

			const prevData = editTarget.cloneNode(false);

			prevData.textContent = prevText;
			editTarget.setAttribute("contenteditable", false);

			if (dataHistory.length >= historySize) { dataHistory.shift(); }
			dataHistory.push({
				sheetNum: table.parentElement.dataset.index,
				data: {
					pos: {row: startRow, col: startCol},
					cellData: [[prevData]],
				},
			});

			editTarget = null;
			prevText = "";
		}

		if (selectPos.start) {
			let row = Array.from(table.rows).indexOf(selectPos.start.parentElement) + 1;
			const col = Array.from(selectPos.start.parentNode.children).indexOf(selectPos.start);

			if (table.rows.length <= row) { return; }

			let nextElement = table.rows[row].cells[col];

			while (nextElement.classList.contains("fake-cell")) {
				if (table.rows.length <= ++row) { return; }
				nextElement = table.rows[row].cells[col];
			}

			selectPos.start = nextElement;
			selectPos.end = selectPos.start;
			paintCells(selectPos);
		}
	} else if (selectPos.start && !editTarget) {
		editTarget = selectPos.start;
		prevText = editTarget.textContent;

		editTarget.textContent = "";
		editTarget.setAttribute("contenteditable", true);
		editTarget.focus();
	}
});

document.querySelector("#tables").addEventListener("dblclick", event => {
	if (event.target.tagName === "TH" || event.target.tagName === "TD") {
		if (event.target.classList.contains("table-header") || event.target === editTarget) { return; }

		editTarget = event.target;
		prevText = editTarget.textContent;

		editTarget.setAttribute("contenteditable", true);
		editTarget.focus();

		const range = document.caretRangeFromPoint(event.clientX, event.clientY);
		const textNode = range.startContainer;
		const offset = range.startOffset;

		document.getSelection().collapse(textNode, offset);
	}
});

whale.storage.local.get("tableData", items => {
	if (items.tableData) {
		const tableParser = /<(table([^>]*)>)(\s|.)*?<\/table>/ig;
		const tables = items.tableData.match(tableParser);

		tables.forEach(table => {
			addSheet(table);
		});

		const sheet = document.querySelector(".sheet:not(.hide)");
		const table = sheet.querySelector("table");
		const effect = document.querySelector("#select-effect");

		sheet.appendChild(effect);
		selectPos.start = table.rows[1].cells[1];
		selectPos.end = selectPos.start;

		paintCells(selectPos);
	}
});
