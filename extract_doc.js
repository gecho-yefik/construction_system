const fs = require('fs');
const path = require('path');

const xml = fs.readFileSync(path.join(__dirname, 'temp_docx/word/document.xml'), 'utf8');

let text = xml
  .replace(/<w:p[ >]/g, '\n')
  .replace(/<w:tr[ >]/g, '\n--- ROW ---\n')
  .replace(/<w:tc[ >]/g, '\t')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'");

text = text.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');
fs.writeFileSync(path.join(__dirname, 'extracted_project_doc.txt'), text, 'utf8');
console.log('Successfully extracted', text.split('\n').length, 'lines.');
