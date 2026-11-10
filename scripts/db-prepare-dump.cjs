// Reorders a D1 export so it can be imported into the LOCAL database.
//
// The export lists each table followed by its rows, so a table that points to another table (a foreign key)
// can get rows before that other table exists, and the local import stops with "no such table".
// This puts every PRAGMA / CREATE statement first and all the rows after them, keeping the order inside each group.
// Input: cinema_db_prod.sql   Output: cinema_db_prod.local.sql   (both are git-ignored: they hold customer data)
const fs = require('fs');

const input = 'cinema_db_prod.sql';
const output = 'cinema_db_prod.local.sql';
const text = fs.readFileSync(input, 'utf8');

// Split into statements at ";" that are not inside a quoted text ('' is an escaped quote inside text)
const statements = [];
let current = '';
let inText = false;
for (let index = 0; index < text.length; index++) {
  const character = text[index];
  current += character;
  if (character === "'") {
    if (inText && text[index + 1] === "'") {
      current += "'";
      index++;
    } else {
      inText = !inText;
    }
  } else if (character === ';' && !inText) {
    statements.push(current.trim());
    current = '';
  }
}
if (current.trim()) statements.push(current.trim());

// A statement over about 100 KB is refused by the local database (SQLITE_TOOBIG). In the export this happens for a few
// audit-log rows that hold a huge old/new value. Inside such a statement every long text is cut to its first 500
// characters (with a note), so the row is kept but small. Statements under the limit are never changed.
const STATEMENT_LIMIT = 95000;
const LONG_TEXT = 20000;
const cutNote = ' ...[cut for local import]';
const truncated = [];
function shrink(statement) {
  if (statement.length <= STATEMENT_LIMIT) return statement;
  truncated.push(statement.slice(0, 40).replace(/\s+/g, ' '));
  return statement.replace(/'(?:[^']|'')*'/g, (literal) => {
    if (literal.length <= LONG_TEXT) return literal;
    let inner = literal.slice(1, 501);
    // never end in the middle of an escaped quote ('')
    const trailingQuotes = inner.length - inner.replace(/'+$/, '').length;
    if (trailingQuotes % 2 === 1) inner = inner.slice(0, -1);
    return "'" + inner + cutNote + "'";
  });
}

const isSchema = (statement) => /^(PRAGMA|CREATE)\b/i.test(statement);
const schemaStatements = statements.filter(isSchema);
const dataStatements = statements.filter((statement) => !isSchema(statement)).map(shrink);

fs.writeFileSync(output, [...schemaStatements, ...dataStatements].join('\n') + '\n');
if (truncated.length) console.log('Shortened ' + truncated.length + ' oversized rows: ' + truncated.join(' | '));
console.log('Prepared ' + output + ': ' + schemaStatements.length + ' schema statements, ' + dataStatements.length + ' data statements.');
