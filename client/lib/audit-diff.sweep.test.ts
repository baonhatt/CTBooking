import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { auditChanges, auditNote, formatAuditValue, isAuditRecord } from './audit-diff';

/**
 * One-off sweep (skipped unless AUDIT_SWEEP_FILE points at an export of audit_logs): runs every saved log line through
 * the change view and lists what would still read badly: fields without a Vietnamese label and values shown as JSON.
 */
const sweepFile = process.env.AUDIT_SWEEP_FILE || '';

describe.skipIf(!sweepFile || !existsSync(sweepFile))('audit log sweep', () => {
  it('every log line reads well', () => {
    const rows: any[] = JSON.parse(readFileSync(sweepFile, 'utf-8'))[0].results;
    const unlabelled = new Map<string, number>();
    const rawValues = new Map<string, string>();
    const kinds = new Set<string>();
    for (const row of rows) {
      kinds.add(`${row.entity_type}/${row.action}`);
      for (const change of auditChanges(row.old_values, row.new_values)) {
        const lastLabel = change.label.split(' › ').pop() || '';
        if (/^[a-z_]+$|^[a-z]+[A-Z]/.test(lastLabel)) unlabelled.set(`${row.entity_type}: ${change.path}`, row.id);
        for (const value of [change.oldValue, change.newValue]) {
          const text = formatAuditValue(change.field, value);
          if (/^[[{]/.test(text)) rawValues.set(`${row.entity_type}: ${change.path}`, text.slice(0, 80));
        }
      }
      // A side that is neither a record nor a note would be lost
      for (const side of [row.old_values, row.new_values]) {
        if (side && !isAuditRecord(side) && !auditNote(side)) unlabelled.set(`unreadable side #${row.id}`, row.id);
      }
    }
    console.log('kinds:', [...kinds].sort().join(', '));
    console.log('unlabelled:', JSON.stringify(Object.fromEntries(unlabelled), null, 1));
    console.log('raw values:', JSON.stringify(Object.fromEntries(rawValues), null, 1));
    expect(rows.length).toBeGreaterThan(0);
  });
});
