import { useId } from 'react';
import { Lock } from 'lucide-react';
import GemInput from './ui/GemInput';
import { useLanguage } from '../contexts/LanguageContext';
import { citiesOf, regionsOf } from '../utils/address';
import { getAddressPlaceholder } from '../utils/auth';

// Where someone lives, for the staff forms and the member profile's edit form:
// street, city and region required. The country is always the gym's own, shown
// but not editable (the server sets it too); city and region suggest that
// country's own names (utils/address.js).
export default function AddressInputs({ value = {}, onChange, errors = {}, gymCountry = '' }) {
  const { t } = useLanguage();
  const id = useId().replace(/:/g, '');
  const country = gymCountry || value.country || '';
  const set = (k) => (e) => onChange(k, e.target.value);
  return (
    <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <GemInput label={t('members.houseNumber')} value={value.houseNumber || ''} onChange={set('houseNumber')} placeholder="e.g. 12B" autoComplete="off" />
      <GemInput label={t('members.street')} required error={errors.street} value={value.street || ''} onChange={set('street')} placeholder={getAddressPlaceholder()} autoComplete="street-address" />
      <div>
        <GemInput label={t('common.city')} required error={errors.city} list={`${id}-cities`} value={value.city || ''} onChange={set('city')} placeholder={citiesOf(country)[0] || t('common.city')} autoComplete="address-level2" />
        <datalist id={`${id}-cities`}>{citiesOf(country).map(c => <option key={c} value={c} />)}</datalist>
      </div>
      <div>
        <GemInput label={t('common.region')} required error={errors.region} list={`${id}-regions`} value={value.region || ''} onChange={set('region')} placeholder={regionsOf(country)[0] || t('common.region')} autoComplete="address-level1" />
        <datalist id={`${id}-regions`}>{regionsOf(country).map(r => <option key={r} value={r} />)}</datalist>
      </div>
      <GemInput label={t('common.postalCode')} value={value.postalCode || ''} onChange={set('postalCode')} placeholder="0000" autoComplete="postal-code" />
      <CountryField country={country} />
    </div>
  );
}

// The gym's country, read-only: everyone at a gym lives where the gym is
export function CountryField({ country, labelStyle }) {
  const { t } = useLanguage();
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelStyle || { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>{t('common.country')}</label>
      <div data-country-field aria-readonly="true" title={t('common.countryFromGym')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: country ? 'var(--text-secondary)' : 'var(--text-muted)', fontFamily: 'DM Sans', cursor: 'not-allowed', minHeight: 38, boxSizing: 'border-box' }}>
        <span>{country || t('common.countryNotSet')}</span>
        <Lock size={12} color="var(--text-muted)" />
      </div>
    </div>
  );
}
