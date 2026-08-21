import { describe, expect, it } from 'vitest';
import { generateMemberStatement, BatchStatement } from '@/lib/chitEngine';

const batches: BatchStatement[] = [
  { batchName: 'Batch A', currentMonth: 3, dueAmount: 6750, payoutTakenMonth: null },
  { batchName: 'Batch B', currentMonth: 6, dueAmount: 7350, payoutTakenMonth: 4 },
];

describe('generateMemberStatement', () => {
  it('sums consolidated dues across batches', () => {
    const statement = generateMemberStatement('Hari Krishna K', '6369081109', batches);
    expect(statement.totalConsolidatedDue).toBe(6750 + 7350);
  });

  it('mentions each batch and its monthly due', () => {
    const statement = generateMemberStatement('Hari Krishna K', '6369081109', batches);
    expect(statement.whatsappMessage).toContain('Batch A');
    expect(statement.whatsappMessage).toContain('₹6,750');
    expect(statement.whatsappMessage).toContain('Batch B');
    expect(statement.whatsappMessage).toContain('₹7,350');
  });

  it('reflects payout status correctly', () => {
    const statement = generateMemberStatement('Hari Krishna K', '6369081109', batches);
    expect(statement.whatsappMessage).toContain('Took 4th Chit Payout');
    expect(statement.whatsappMessage).toContain('Not Taken Yet');
  });

  it('builds a wa.me link with the sanitized phone number', () => {
    const statement = generateMemberStatement('Hari Krishna K', '+91 6369081109', batches);
    expect(statement.whatsappUrl).toContain('https://wa.me/916369081109');
    expect(decodeURIComponent(statement.whatsappUrl)).toContain('Hari Krishna K');
  });

  it('does not duplicate the 91 country code', () => {
    const statement = generateMemberStatement('Hari Krishna K', '6369081109', batches);
    expect(statement.whatsappUrl).toContain('https://wa.me/916369081109');
    expect(statement.whatsappUrl).not.toContain('wa.me/91916369081109');
  });

  it('handles an empty batch list', () => {
    const statement = generateMemberStatement('Hari Krishna K', '6369081109', []);
    expect(statement.totalConsolidatedDue).toBe(0);
    expect(statement.whatsappMessage).toContain('TOTAL CONSOLIDATED DUE: ₹0');
  });
});