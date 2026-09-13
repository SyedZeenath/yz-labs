import { createContext, useContext, useState } from "react";

const ContactContext = createContext(null);

// One shared open/close flag for the contact modal, same pattern as
// CartProvider's isOpen/openCart/closeCart — needed now that Nav's own
// "Contact" link has to be able to open it too, not just the Email
// buttons inside GetInTouchChapter/CTAFooter that used to each carry
// their own local, unrelated `contactOpen` state.
export function ContactProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = {
    isOpen,
    openContact: () => setIsOpen(true),
    closeContact: () => setIsOpen(false),
  };

  return <ContactContext.Provider value={value}>{children}</ContactContext.Provider>;
}

export function useContact() {
  const ctx = useContext(ContactContext);
  if (!ctx) throw new Error("useContact must be used within ContactProvider");
  return ctx;
}
