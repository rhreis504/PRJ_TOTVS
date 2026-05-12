# Apps Script multi-projeto para escrita no Google Sheets

Use este Web App quando a mesma implantação do Google Apps Script precisar gravar em mais de um projeto/planilha. O sistema envia `spreadsheetId` e `sheetName` no corpo do POST a partir da configuração do projeto ativo.

## Pré-requisitos na configuração do sistema

Na aba **Configuração**, fonte **Pendências**, preencha:

- **Endereço de Rede (URL)** com uma URL do Google Sheets no formato `/spreadsheets/d/{ID}/...`; ou preencha manualmente o campo **ID da Planilha**.
- **Nome da Aba** com o nome exato da aba, por exemplo `Pendências`.
- **URL de Escrita (Apps Script)** com a URL do Web App publicada terminada em `/exec`.

> Observação: URLs publicadas no formato `/spreadsheets/d/e/2PACX...` não contêm o ID interno que o Apps Script usa em `SpreadsheetApp.openById`. Nesse caso, preencha **ID da Planilha** manualmente.

## Código do Apps Script

```javascript
const DEFAULT_SHEET_NAME = 'Pendências';
const HEADER_ROW = 5;

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_(spreadsheetId, sheetName) {
  if (!spreadsheetId) {
    throw new Error('spreadsheetId não informado pelo sistema.');
  }

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const finalSheetName = sheetName || DEFAULT_SHEET_NAME;
  const sheet = ss.getSheetByName(finalSheetName);

  if (!sheet) {
    throw new Error(`Aba não encontrada: ${finalSheetName}`);
  }

  return sheet;
}

function getHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) {
    throw new Error('A planilha não possui colunas.');
  }

  return sheet
    .getRange(HEADER_ROW, 1, 1, lastColumn)
    .getValues()[0]
    .map(header => String(header).trim());
}

function findRowById_(sheet, headers, id) {
  const idColumnIndex = headers.indexOf('ID');

  if (idColumnIndex === -1) {
    throw new Error('Cabeçalho ID não encontrado.');
  }

  const firstDataRow = HEADER_ROW + 1;
  const lastRow = sheet.getLastRow();

  if (lastRow < firstDataRow) {
    return -1;
  }

  const ids = sheet
    .getRange(firstDataRow, idColumnIndex + 1, lastRow - HEADER_ROW, 1)
    .getValues()
    .map(row => String(row[0]).trim());

  const foundIndex = ids.findIndex(value => value === String(id).trim());

  return foundIndex === -1 ? -1 : foundIndex + firstDataRow;
}

function rowObjectToValues_(headers, row) {
  return headers.map(header => row && row[header] !== undefined ? row[header] : '');
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');

    const action = payload.action;
    const row = payload.row || {};
    const id = String(payload.id || row.ID || row['ID'] || '').trim();
    const spreadsheetId = String(payload.spreadsheetId || '').trim();
    const sheetName = String(payload.sheetName || payload.sheet || DEFAULT_SHEET_NAME).trim();

    if (!action) {
      throw new Error('Ação não informada.');
    }

    if (!id && action !== 'create') {
      throw new Error('ID não informado.');
    }

    const sheet = getSheet_(spreadsheetId, sheetName);
    const headers = getHeaders_(sheet);
    const values = rowObjectToValues_(headers, row);

    if (action === 'create') {
      const existingRow = id ? findRowById_(sheet, headers, id) : -1;

      if (existingRow !== -1) {
        sheet.getRange(existingRow, 1, 1, headers.length).setValues([values]);

        return jsonResponse({
          ok: true,
          action: 'update',
          id,
          spreadsheetId,
          sheetName,
          rowNumber: existingRow,
          message: 'Linha existente atualizada.'
        });
      }

      sheet.appendRow(values);

      return jsonResponse({
        ok: true,
        action: 'create',
        id,
        spreadsheetId,
        sheetName,
        rowNumber: sheet.getLastRow(),
        message: 'Linha criada.'
      });
    }

    if (action === 'update') {
      const rowNumber = findRowById_(sheet, headers, id);

      if (rowNumber === -1) {
        throw new Error(`ID não encontrado para atualização: ${id}`);
      }

      sheet.getRange(rowNumber, 1, 1, headers.length).setValues([values]);

      return jsonResponse({
        ok: true,
        action: 'update',
        id,
        spreadsheetId,
        sheetName,
        rowNumber,
        message: 'Linha atualizada.'
      });
    }

    if (action === 'delete') {
      const rowNumber = findRowById_(sheet, headers, id);

      if (rowNumber === -1) {
        throw new Error(`ID não encontrado para exclusão: ${id}`);
      }

      sheet.deleteRow(rowNumber);

      return jsonResponse({
        ok: true,
        action: 'delete',
        id,
        spreadsheetId,
        sheetName,
        rowNumber,
        message: 'Linha excluída.'
      });
    }

    throw new Error(`Ação inválida: ${action}`);
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error.message
    });
  }
}
```
