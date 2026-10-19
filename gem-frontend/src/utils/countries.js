// Where a gym can be, and what its people's phone numbers and addresses look
// like. One list, used by the sign-up form and by every form that suggests an
// address afterwards.
export const COUNTRIES = [
  { code: 'CM', name: 'Cameroon',        flag: '🇨🇲', dial: '+237', placeholder: '6XX XXX XXX',    currency: 'XAF', currencySymbol: 'FCFA', locale: 'fr-FR',
    stripes: ['#007A5E','#CE1126','#FCD116'], orient: 'v',
    addressPh: 'e.g. Carrefour Warda, Rue Njo-Njo',
    cities: ['Yaoundé','Douala','Bamenda','Bafoussam','Garoua','Maroua','Ngaoundéré','Bertoua','Kumba','Limbe','Buea','Edéa','Nkongsamba','Mbalmayo','Ebolowa','Kribi','Dschang','Foumban','Sangmélima','Tibati'] },
  { code: 'NG', name: 'Nigeria',         flag: '🇳🇬', dial: '+234', placeholder: '8XX XXX XXXX',   currency: 'NGN', currencySymbol: '₦', locale: 'en-NG', symbolFirst: true,
    stripes: ['#008751','#FFFFFF','#008751'], orient: 'v',
    addressPh: 'e.g. 14 Ozumba Mbadiwe Ave, Victoria Island',
    cities: ['Lagos','Abuja','Kano','Ibadan','Port Harcourt','Benin City','Kaduna','Enugu','Onitsha','Warri','Aba','Calabar','Uyo','Abeokuta','Sokoto','Zaria','Jos','Ilorin','Maiduguri','Asaba'] },
  { code: 'GH', name: 'Ghana',           flag: '🇬🇭', dial: '+233', placeholder: '2X XXX XXXX',    currency: 'GHS', currencySymbol: 'GH₵', locale: 'en-GH', symbolFirst: true,
    stripes: ['#006B3F','#FCD116','#CE1126'], orient: 'h',
    addressPh: 'e.g. 3 Ring Road, East Legon',
    cities: ['Accra','Kumasi','Tamale','Takoradi','Cape Coast','Tema','Obuasi','Madina','Koforidua','Ho','Sunyani','Wa','Bolgatanga','Techiman','Berekum'] },
  { code: 'SN', name: 'Senegal',         flag: '🇸🇳', dial: '+221', placeholder: '7X XXX XXXX',    currency: 'XOF', currencySymbol: 'FCFA', locale: 'fr-SN',
    stripes: ['#00853F','#FDEF42','#E31B23'], orient: 'v',
    addressPh: 'e.g. Rue 10 x 23, Médina',
    cities: ['Dakar','Thiès','Kaolack','Saint-Louis','Ziguinchor','Touba','Mbour','Rufisque','Diourbel','Louga','Fatick','Tambacounda','Kolda','Sédhiou'] },
  { code: 'CI', name: "Côte d'Ivoire",   flag: '🇨🇮', dial: '+225', placeholder: '07 XX XX XX XX', currency: 'XOF', currencySymbol: 'FCFA', locale: 'fr-CI',
    stripes: ['#F77F00','#FFFFFF','#009A00'], orient: 'v',
    addressPh: 'e.g. Rue des Jardins, Cocody',
    cities: ['Abidjan','Bouaké','Daloa','San-Pédro','Yamoussoukro','Korhogo','Man','Gagnoa','Abengourou','Divo','Anyama','Grand-Bassam','Soubré','Odienné'] },
  { code: 'KE', name: 'Kenya',           flag: '🇰🇪', dial: '+254', placeholder: '7XX XXX XXX',    currency: 'KES', currencySymbol: 'KSh', locale: 'en-KE', symbolFirst: true,
    stripes: ['#006600','#CC0000','#000000'], orient: 'h',
    addressPh: 'e.g. Ngong Road, Kilimani',
    cities: ['Nairobi','Mombasa','Kisumu','Nakuru','Eldoret','Thika','Malindi','Kitui','Machakos','Meru','Nyeri','Kakamega','Kericho','Embu','Garissa'] },
  { code: 'ZA', name: 'South Africa',    flag: '🇿🇦', dial: '+27',  placeholder: '7X XXX XXXX',    currency: 'ZAR', currencySymbol: 'R', locale: 'en-ZA', symbolFirst: true,
    stripes: ['#007A4D','#FFB81C','#DE3831'], orient: 'h',
    addressPh: 'e.g. 12 Bree Street, De Waterkant',
    cities: ['Johannesburg','Cape Town','Durban','Pretoria','Port Elizabeth','Bloemfontein','Polokwane','Nelspruit','East London','Kimberley','Rustenburg','George','Pietermaritzburg','Centurion','Soweto'] },
  { code: 'FR', name: 'France',          flag: '🇫🇷', dial: '+33',  placeholder: '6X XX XX XX',    currency: 'EUR', currencySymbol: '€', locale: 'fr-FR',
    stripes: ['#002395','#FFFFFF','#ED2939'], orient: 'v',
    addressPh: 'ex. 14 Rue de la Paix, 1er arrondissement',
    cities: ['Paris','Lyon','Marseille','Toulouse','Nice','Nantes','Strasbourg','Montpellier','Bordeaux','Lille','Rennes','Reims','Saint-Étienne','Toulon','Le Havre','Grenoble','Dijon','Angers','Nîmes'] },
  { code: 'GB', name: 'United Kingdom',  flag: '🇬🇧', dial: '+44',  placeholder: '7XXX XXX XXX',   currency: 'GBP', currencySymbol: '£', locale: 'en-GB', symbolFirst: true,
    stripes: ['#012169','#FFFFFF','#C8102E'], orient: 'h',
    addressPh: 'e.g. 42 Baker Street, Marylebone',
    cities: ['London','Birmingham','Manchester','Leeds','Glasgow','Liverpool','Edinburgh','Bristol','Cardiff','Belfast','Sheffield','Leicester','Nottingham','Newcastle','Southampton','Portsmouth','Oxford','Cambridge'] },
  { code: 'US', name: 'United States',   flag: '🇺🇸', dial: '+1',   placeholder: '(XXX) XXX-XXXX', currency: 'USD', currencySymbol: '$', locale: 'en-US', symbolFirst: true,
    stripes: ['#B22234','#FFFFFF','#3C3B6E'], orient: 'h',
    addressPh: 'e.g. 123 W 42nd St, Midtown',
    cities: ['New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego','Dallas','San Jose','Austin','Jacksonville','Fort Worth','Columbus','Charlotte','Indianapolis','Seattle','Denver','Washington DC','Nashville','Miami','Atlanta'] },
];

export const countryByCode = (code) => COUNTRIES.find(c => c.code === code) || null;
export const countryByName = (name) => {
  const wanted = String(name || '').trim().toLowerCase();
  return wanted ? COUNTRIES.find(c => c.name.toLowerCase() === wanted) || null : null;
};
