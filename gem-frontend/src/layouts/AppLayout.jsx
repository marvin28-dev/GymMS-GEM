import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import DemoTour, { useDemoTour, DemoTourButton } from '../components/DemoTour';

export default function AppLayout() {
  const { pathname } = useLocation();
  const { show, open, close } = useDemoTour();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 260, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main key={pathname} className="page-fade" style={{ padding: 28, flex: 1 }}>
          <Outlet />
        </main>
      </div>

      {show && <DemoTour onClose={close} />}
      {!show && <DemoTourButton onClick={open} />}
    </div>
  );
}
