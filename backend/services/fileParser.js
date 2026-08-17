const pdfParse = require('pdf-parse');
const xlsx = require('xlsx');

/**
 * Trich xuat van ban tu file PDF
 */
async function parsePDF(buffer) {
    const data = await pdfParse(buffer);
    return data.text;
}

/**
 * Trich xuat du lieu bang tinh BOQ tu file Excel
 */
function parseExcel(buffer) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    let fullText = '';
    
    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        fullText += `--- Sheet: ${sheetName} ---\n`;
        fullText += xlsx.utils.sheet_to_txt(sheet) + '\n';
    });
    
    return fullText;
}

module.exports = { parsePDF, parseExcel };