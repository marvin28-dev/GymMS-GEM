import { COUNTRIES, countryByName } from './countries';

// Where people live, the same way on every form (members, visitors, staff):
// street, city and region are required, the country starts as the gym's own.
// Region and city boxes suggest the country's own names but take anything.

const REGIONS = {
  CM: ['Adamawa', 'Centre', 'East', 'Far North', 'Littoral', 'North', 'North-West', 'South', 'South-West', 'West'],
  NG: ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT Abuja', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'],
  GH: ['Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta', 'Western', 'Western North'],
  SN: ['Dakar', 'Diourbel', 'Fatick', 'Kaffrine', 'Kaolack', 'Kédougou', 'Kolda', 'Louga', 'Matam', 'Saint-Louis', 'Sédhiou', 'Tambacounda', 'Thiès', 'Ziguinchor'],
  KE: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 'Machakos', 'Kajiado', 'Uasin Gishu', 'Kakamega', 'Nyeri', 'Meru', 'Kilifi'],
  ZA: ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'],
  FR: ['Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire', 'Corse', 'Grand Est', 'Hauts-de-France', 'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire', "Provence-Alpes-Côte d'Azur"],
  GB: ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  US: ['California', 'Florida', 'Georgia', 'Illinois', 'New York', 'North Carolina', 'Ohio', 'Pennsylvania', 'Texas', 'Washington'],
};

export const COUNTRY_NAMES = COUNTRIES.map(c => c.name);
export const regionsOf = (countryName) => REGIONS[countryByName(countryName)?.code] || [];
export const citiesOf = (countryName) => countryByName(countryName)?.cities || [];

// One line, for a profile: "12B, Rue Njo-Njo, Douala, Littoral, Cameroon"
export const formatAddress = (x) => [x?.houseNumber, x?.street, x?.city, x?.region, x?.postalCode, x?.country].filter(Boolean).join(', ');

// The required parts, checked the same way on every form
export function addressErrors(x, requiredMsg) {
  const e = {};
  if (!String(x?.street || '').trim()) e.street = requiredMsg;
  if (!String(x?.city || '').trim()) e.city = requiredMsg;
  if (!String(x?.region || '').trim()) e.region = requiredMsg;
  return e;
}
