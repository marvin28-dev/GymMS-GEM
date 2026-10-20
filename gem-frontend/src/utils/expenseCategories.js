// An expense's category by its name in the reader's language. The desk and the
// office offer different lists; both are stored by their English name, and a
// category someone typed is shown as written.
const KEYS = {
  Supplies: 'expCatSupplies', Cleaning: 'expCatCleaning', Maintenance: 'expCatMaintenance',
  'Food & Drinks': 'expCatFoodDrinks', Equipment: 'expCatEquipment', Transport: 'expCatTransport',
  Other: 'expCatOther', Utilities: 'expCatUtilities', Rent: 'expCatRent', Salaries: 'expCatSalaries',
};

export function expenseCategoryName(category, t) {
  const key = KEYS[category];
  return key ? t(`frontDesk.${key}`) : category;
}
