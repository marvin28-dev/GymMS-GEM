import { useState, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import BottomTabBar from '../components/BottomTabBar';
import NavDrawer from '../components/NavDrawer';
import { useIsMobile } from '../hooks/useIsMobile';
import { hasNavigation } from '../utils/rolePages';
import { getRole } from '../utils/auth';
import EmailConfirmBanner from '../components/EmailConfirmBanner';
import PageLoader from '../components/ui/PageLoader';

export default function AppLayout() {
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // An account with only its own profile has nothing to put in a menu
  const navigable = hasNavigation(getRole());

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Mobile top bar: just branding + bell + avatar */}
        <Header isMobile={true} />

        {/* Nav drawer slides in from left */}
        {navigable && <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />}

        {/* Page content */}
        <main
          key={pathname}
          data-tour="main-content"
          className="page-fade"
          style={{
            flex: 1,
            minWidth: 0,
            overflowX: 'hidden',
            padding: navigable ? '0 0 88px' : '0 0 24px',
          }}
        >
          <EmailConfirmBanner isMobile />
          {/* The header stays while a page arrives, and the page's shape stands in
              for it. The phone's main area has no side padding of its own. */}
          <Suspense fallback={<div style={{ padding: 16 }}><PageLoader /></div>}>
            <Outlet />
          </Suspense>
        </main>

        {/* Bottom tab bar */}
        {navigable && <BottomTabBar onMoreClick={() => setDrawerOpen(true)} />}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {navigable && <Sidebar open={true} isMobile={false} />}

      <div
        style={{
          marginLeft: navigable ? 260 : 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <Header isMobile={false} />
        <main
          key={pathname}
          data-tour="main-content"
          className="page-fade gem-page-main"
          style={{ padding: 28, flex: 1 }}
        >
          <EmailConfirmBanner />
          {/* The sidebar and header stay while a page arrives, and the page's
              shape stands in for it (it used to be an empty area) */}
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
