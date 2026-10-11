import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { FullScreenLoader, RequireAdmin, RequireAuth, RequireManager } from '@/components/RouteGuards';
import { useAuth } from '@/lib/auth';
import Login from '@/pages/Login';
import { Assignments, CountDetail, Counts, Dashboard, DeviceDetail, Devices, Faults, Labels, MyDevices, NotFound, PersonSheetPage, Profile, ReceiptPage, Reports, Scan, UsersPage } from '@/pages/lazyPages';

function Home() {
  const { isManager } = useAuth();
  return isManager ? <Dashboard /> : <MyDevices />;
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="devices/:id" element={<DeviceDetail />} />
            <Route path="scan/:token" element={<Scan />} />
            <Route path="profile" element={<Profile />} />
            <Route path="faults" element={<Faults />} />
            <Route path="tutanak/:id" element={<ReceiptPage />} />
            <Route path="foy/:userId" element={<PersonSheetPage />} />
            <Route element={<RequireManager />}>
              <Route path="devices" element={<Devices />} />
              <Route path="assignments" element={<Assignments />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="reports" element={<Reports />} />
              <Route path="etiketler" element={<Labels />} />
            </Route>
            <Route element={<RequireAdmin />}>
              <Route path="counts" element={<Counts />} />
              <Route path="counts/:id" element={<CountDetail />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
