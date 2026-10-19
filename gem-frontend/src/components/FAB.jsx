import { Plus } from 'lucide-react';

export default function FAB({ onClick, icon: Icon = Plus, label }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        position: 'fixed',
        bottom: 88,
        right: 20,
        width: 52,
        height: 52,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #c9a96e, #b08d4a)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(201,169,110,0.5)',
        zIndex: 290,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.08)';
        e.currentTarget.style.boxShadow = '0 6px 28px rgba(201,169,110,0.65)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(201,169,110,0.5)';
      }}
    >
      <Icon size={22} color="#0a0a0f" strokeWidth={2.2} />
    </button>
  );
}
