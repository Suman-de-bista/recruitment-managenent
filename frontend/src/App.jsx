import { Navigate, Route, Routes } from "react-router-dom";
import { getSession } from "./api/client";
import AppHeader from "./components/AppHeader.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import CandidateDetailPage from "./pages/CandidateDetailPage.jsx";

function RequireAuth({ children }) {
  const { token } = getSession();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/candidates/:id"
          element={
            <RequireAuth>
              <CandidateDetailPage />
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}
