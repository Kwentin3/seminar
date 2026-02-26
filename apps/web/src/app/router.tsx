import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../layout/AppLayout";
import { AdminPage } from "../routes/AdminPage";
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
      }
    ]
  }
]);