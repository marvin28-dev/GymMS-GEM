// Where the gym is, written the way somebody would say it out loud.
//
// The street address and the city are separate fields, and a gym that only
// filled in "14 Accra St" showed just that - no use to anyone who does not
// already know the town. The city is always included, but never twice: plenty
// of people type it into the address line as well.

export function gymAddress(gym) {
  const street = String(gym?.location || '').trim();
  const city = String(gym?.city || '').trim();
  if (!city) return street;
  if (!street) return city;
  const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const alreadyThere = new RegExp(`(^|[,\\s])${escaped}([,\\s]|$)`, 'i').test(street);
  return alreadyThere ? street : `${street}, ${city}`;
}
