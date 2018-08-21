function htmlToElement(html) {
	const template = document.createElement("template");

	template.innerHTML = html.trim();
	return template.content.firstChild;
}

function downloadAsCSV(tableData) {
	const tagNameParser = /(<([^>]+)>)/ig;
	const tableParser = /<(table([^>]*)>)(\s|.)*?<\/table>/ig;
	const tableRowParser = /<(tr([^>]*)>)(\s|.)*?<\/tr>/ig;
	const tableElementsParser = /<(t[dh])([^>]*)>(.*?)<\/\1>/ig;

	let csvContents = "data:text/csv;charset=utf-8,";

	const tables = tableData.match(tableParser);

	tables.forEach(table => {
		const rows = table.match(tableRowParser);

		if (rows) {
			rows.forEach(row => {
				const elements = row.match(tableElementsParser);

				if (elements) {
					elements.forEach(element => {
						csvContents += `${element.replace(tagNameParser, "")},`;
					});
				}
				csvContents += "\n";
			});
		} else {
			const elements = table.match(tableElementsParser);

			if (elements) {
				elements.forEach(element => {
					csvContents += `${element.replace(tagNameParser, "")},`;
				});
			}
		}

		csvContents += "\n";
	});

	const encodedUri = encodeURI(csvContents);

	whale.downloads.download({
		url: encodedUri,
		filename: "data.csv",
	});
}

function downloadAsXLS(tablesHTML) {
	const tableParser = /<(table([^>]*)>)(\s|.)*?<\/table>/ig;
	const tables = tablesHTML.match(tableParser);

	const dataTypeUri = "data:application/vnd.ms-excel;charset=UTF-8,";

	const tmplWorkbookXML =
		`<?xml version="1.0"?>
		<?mso-application progid="Excel.Sheet?">
		<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
			<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
				<Author>Editable</Author>
				<Created>{created}</Created>
			</DocumentProperties>
			<Styles>
				<Style ss:ID="Default" ss:Name="Normal">
					<Alignment ss:Vertical="Center"/>
				</Style>
			</Styles>
			{worksheets}
		</Workbook>`;

	const tmplWorksheetXML =
		`<Worksheet ss:Name="{nameWS}">
			<Table>{rows}</Table>
		</Worksheet>`;

	const tmplCellXML =
		`<Cell{attr}>
			<Data ss:Type="{nameType}">{data}</Data>
		</Cell>`;

	function format(s, c) {
		return s.replace(/{(\w+)}/g, (m, p) => c[p]);
	}

	let ctx;
	let worksheetsXML = "";
	let rowsXML = "";

	tables.forEach((tableHTML, idx) => {
		const table = htmlToElement(tableHTML);

		for (let i = 0; i < table.rows.length; ++i) {
			const row = table.rows[i];
			let index = 1;

			rowsXML += "<Row>";
			for (let j = 0; j < row.cells.length; ++j, ++index) {
				const cell = row.cells[j];
				let attributes = "";

				if (cell.getAttribute("index")) {
					attributes += ` ss:Index="${cell.getAttribute("index")}"`;
					index = parseInt(cell.getAttribute("index"), 10);
				}

				if (cell.colSpan > 1) {
					attributes += ` ss:MergeAcross="${cell.colSpan - 1}"`;
				}

				if (cell.rowSpan > 1) {
					attributes += ` ss:MergeDown="${cell.rowSpan - 1}"`;

					for (let k = 1; k < cell.rowSpan; ++k) {
						const spanedRow = table.rows[i + k];
						let tmp = index;
						let ci;

						for (ci = 0; ci < spanedRow.cells.length && tmp > 0; ++ci) {
							if (spanedRow.cells[ci].getAttribute("index")) {
								tmp -= parseInt(spanedRow.cells[ci].getAttribute("index"), 10);
							} else {
								--tmp;
							}
							if (tmp < 1) { break; }
						}
						spanedRow.cells[ci].setAttribute("index", index + cell.colSpan);
					}
				}

				const dataValue = cell.textContent;
				const dataType = !dataValue || isNaN(dataValue) ? "String" : "Number";

				ctx = {
					attr: attributes,
					nameType: dataType,
					data: dataValue,
				};

				rowsXML += format(tmplCellXML, ctx);
			}
			rowsXML += "</Row>";
		}

		ctx = {
			rows: rowsXML,
			nameWS: `Sheet${idx}`,
		};

		worksheetsXML += format(tmplWorksheetXML, ctx);
		rowsXML = "";
	});

	ctx = {
		created: (new Date())
			.toISOString()
			.replace(/(\.)/, ":")
			.replace(/(\dZ)/, "Z"),
		worksheets: worksheetsXML,
	};

	const workbookXML = format(tmplWorkbookXML, ctx);
	const encodedUri = encodeURI(dataTypeUri + workbookXML);

	whale.downloads.download({
		url: encodedUri,
		filename: "data.xls",
	});
}

function edit() {
	const editorURL = whale.runtime.getURL("./editor/index.html");

	whale.tabs.create({url: editorURL});
}

const RESULTHANDLING = {
	"edit": edit,
	"download-csv": downloadAsCSV,
	"download-xls": downloadAsXLS,
};

whale.commands.onCommand.addListener(command => {
	whale.tabs.query({active: true}, tabs => {
		whale.tabs.sendMessage(tabs[0].id, {
			msg: "startCapture",
			type: command,
		}, success => {
			if (success) {
				whale.browserAction.setBadgeText({text: "capture"});
			}
		});
	});
});

whale.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.msg === "resultHandling") {
		const handlingMethod = RESULTHANDLING[message.type];
		const success = typeof handlingMethod === "function";

		sendResponse(success);
		if (success) {
			whale.storage.local.get("tableData", items => {
				if (items.tableData) {
					handlingMethod(items.tableData);
				}
			});
		}
	} else if (message.msg === "endCapture") {
		whale.browserAction.setBadgeText({text: ""});
	}
});
