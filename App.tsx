import { Suspense } from "react";
import { useRoutes, Routes, Route } from "react-router-dom";
import Home from "@/components/home";
import ReportIssueForm from "@/components/ReportIssueForm";
import ReportStatusTracker from "@/components/ReportStatusTracker";
import SplashScreen from "@/components/SplashScreen";
import Onboarding from "@/components/Onboarding";
import Login from "@/components/Login";
import { I18nProvider } from "@/lib/i18n";

function App() {

  return (
    <Suspense fallback={<p>Loading...</p>}>
      <I18nProvider>
        <>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/splash" element={<SplashScreen />} />
            <Route path="/welcome" element={<Onboarding />} />
            <Route path="/login" element={<Login />} />
            <Route path="/report" element={<ReportIssueForm onSuccess={() => window.location.href = "/"} />} />
            <Route path="/track" element={<ReportStatusTracker onBack={() => window.location.href = "/"} />} />
          </Routes>
        </>
      </I18nProvider>
    </Suspense>
  );
}

export default App;