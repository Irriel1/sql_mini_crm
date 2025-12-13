import { BrowserRouter, Routes, Route } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RequireAuth from "./auth/RequireAuth";
import DashboardPage from "./pages/DashBoardPage.jsx";
import Layout from "./layout/Layout.jsx";

// pages
import ItemsPage from "./pages/ItemsPage";
import ItemDetailPage from "./pages/ItemDetailPage";
import ItemFormPage from "./pages/ItemFormPage";

import ItemVariantsPage from "./pages/ItemsVariantsPage.jsx"; 
import VariantFormPage from "./pages/VariantFormPage"; 
// import MovementsPage from "./pages/MovementsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* PROTECTED */}
        <Route element={<RequireAuth />}>
          {/* LAYOUT WRAPPER */}
          <Route element={<Layout />}>
            {/* DASHBOARD */}
            <Route path="/" element={<DashboardPage />} />

            {/* ITEMS */}
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/items/new" element={<ItemFormPage mode="create" />} />
            <Route path="/items/:id" element={<ItemDetailPage />} />
            <Route path="/items/:id/edit" element={<ItemFormPage mode="edit" />} />

            {/* VARIANTS (nested under item) */}
            <Route path="/items/:itemId/variants" element={<ItemVariantsPage />} />

            {/* až budeš mít hotové stránky, odkomentuj: */}
            
            <Route path="/items/:itemId/variants/new" element={<VariantFormPage mode="create" />} />
            <Route path="/items/:itemId/variants/:variantId/edit" element={<VariantFormPage mode="edit" />} />
            

            {/* MOVEMENTS */}
            {/*
            <Route path="/movements" element={<MovementsPage />} />
            */}
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
