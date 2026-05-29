import AppRoutes from './routes/AppRoutes';
import DemoTour, { useDemoTour, DemoTourButton } from './components/DemoTour';

export default function App() {
  const { show, open, close } = useDemoTour();
  return (
    <>
      <AppRoutes />
      {show && <DemoTour onClose={close} />}
      {!show && <DemoTourButton onClick={open} />}
    </>
  );
}
