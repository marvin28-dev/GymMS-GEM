import { getDateLocale } from './date';

// A sensible, human description for a payment, filled into the form so the
// staff don't have to type it. They can still edit or clear it. Membership and
// registration get a line; product/other are left blank for the staff to write.
export function autoPaymentDescription(member, type) {
  const pkgName = member?.package?.name || member?.package || '';
  if (type === 'membership') {
    const month = new Date().toLocaleDateString(getDateLocale(), { month: 'long', year: 'numeric' });
    const cap = month.charAt(0).toUpperCase() + month.slice(1);
    // A frozen member who was charged the freeze fee is paying that fee, so say so
    if (member?.status === 'frozen' && member?.freezeFeeLastChargedAt) {
      return pkgName ? `Freeze fee - ${pkgName} - ${cap}` : `Freeze fee - ${cap}`;
    }
    return pkgName ? `${pkgName} membership - ${cap}` : `Membership - ${cap}`;
  }
  if (type === 'registration') {
    return pkgName ? `Registration fee - ${pkgName}` : 'Registration fee';
  }
  return '';
}
