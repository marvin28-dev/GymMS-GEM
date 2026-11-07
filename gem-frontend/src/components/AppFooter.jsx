import PoweredBy from './ui/PoweredBy';

// The foot of every signed-in screen (AppLayout and the front desk): the
// maker's credit, quiet. GEM's support contacts are not here (the owner,
// 7 November 2026): they are on the Support page and wherever something went
// wrong (LoadFailed, the error screen, the slow-loading notice, page not found).
export default function AppFooter({ style }) {
  return (
    <footer data-app-footer style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center', ...style }}>
      <PoweredBy style={{ fontSize: 10.5 }} />
    </footer>
  );
}
