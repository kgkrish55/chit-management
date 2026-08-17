export interface BatchStatement {
  batchName: string;
  currentMonth: number;
  dueAmount: number;
  payoutTakenMonth: number | null;
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function generateMemberStatement(
  memberName: string,
  phone: string,
  batches: BatchStatement[]
) {
  let totalConsolidatedDue = 0;
  let textBreakdown = "";

  batches.forEach((b, idx) => {
    totalConsolidatedDue += b.dueAmount;

    const payoutStatus = b.payoutTakenMonth
      ? `🏆 *Took ${b.payoutTakenMonth}${ordinalSuffix(b.payoutTakenMonth)} Chit Payout*`
      : `⏳ *Chit Turn: Not Taken Yet*`;

    textBreakdown += `\n*${idx + 1}. ${b.batchName}*\n`;
    textBreakdown += `• Current Month: Month ${b.currentMonth}\n`;
    textBreakdown += `• Monthly Due: ₹${b.dueAmount.toLocaleString()}\n`;
    textBreakdown += `• Status: ${payoutStatus}\n`;
  });

  const whatsappMessage = `Hi *${memberName}*,

Here is your consolidated Chit Statement:
${textBreakdown}
----------------------------------
*TOTAL CONSOLIDATED DUE: ₹${totalConsolidatedDue.toLocaleString()}*
----------------------------------

Tap an action below to proceed:`;

  return {
    totalConsolidatedDue,
    whatsappMessage,
    whatsappUrl: `https://wa.me/91${phone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`
  };
}