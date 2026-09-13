import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { CartProvider } from "./store/cart.jsx";
import { ProductsProvider } from "./store/products.jsx";
import { ContactProvider } from "./store/contact.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ProductsProvider>
        <CartProvider>
          <ContactProvider>
            <App />
          </ContactProvider>
        </CartProvider>
      </ProductsProvider>
    </BrowserRouter>
  </StrictMode>
);
