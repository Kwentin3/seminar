import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../layout/AppLayout";
import { AdminPage } from "../routes/AdminPage";
import { CabinetLlmSettingsPage } from "../routes/CabinetLlmSettingsPage";
import { CabinetLoginPage } from "../routes/CabinetLoginPage";
import { CabinetMaterialPage } from "../routes/CabinetMaterialPage";
import { CabinetPage } from "../routes/CabinetPage";
import { LandingPage } from "../routes/LandingPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <LandingPage />
      },
      {
        path: "admin",
        element: <AdminPage />
      },
      {
        path: "cabinet/login",
        element: <CabinetLoginPage />
      },
      {
        path: "cabinet",
        element: <CabinetPage />
      },
      {
        path: "cabinet/materials/:slug",
        element: <CabinetMaterialPage />
      },
      {
        path: "cabinet/admin/llm-simplify",
        element: <CabinetLlmSettingsPage />
      }
    ]
  }
]);
