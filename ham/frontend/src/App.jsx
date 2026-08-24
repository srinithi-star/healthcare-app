import { Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Home from './pages/Home.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import Settings from './pages/Settings.jsx';

import DoctorSearch from './pages/patient/DoctorSearch.jsx';
import BookAppointment from './pages/patient/BookAppointment.jsx';
import MyAppointments from './pages/patient/MyAppointments.jsx';
import AppointmentDetail from './pages/patient/AppointmentDetail.jsx';

import Queue from './pages/doctor/Queue.jsx';
import VisitDetail from './pages/doctor/VisitDetail.jsx';

import AdminDoctors from './pages/admin/AdminDoctors.jsx';
import AdminDoctorDetail from './pages/admin/AdminDoctorDetail.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-clinical-50">
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/settings"
          element={
            <ProtectedRoute roles={['PATIENT', 'DOCTOR']}>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Patient portal */}
        <Route
          path="/patient"
          element={
            <ProtectedRoute roles={['PATIENT']}>
              <DoctorSearch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/doctors/:id"
          element={
            <ProtectedRoute roles={['PATIENT']}>
              <BookAppointment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/appointments"
          element={
            <ProtectedRoute roles={['PATIENT']}>
              <MyAppointments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/appointments/:id"
          element={
            <ProtectedRoute roles={['PATIENT']}>
              <AppointmentDetail />
            </ProtectedRoute>
          }
        />

        {/* Doctor portal */}
        <Route
          path="/doctor"
          element={
            <ProtectedRoute roles={['DOCTOR']}>
              <Queue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/appointments/:id"
          element={
            <ProtectedRoute roles={['DOCTOR']}>
              <VisitDetail />
            </ProtectedRoute>
          }
        />

        {/* Admin portal */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminDoctors />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/doctors/:id"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminDoctorDetail />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}
