import React, { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import ConnectWalletButton from "./ConnectWalletButton";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { FaTwitter, FaFacebook, FaYoutube } from "react-icons/fa";

// Custom theme colors
//const colors = {
 // primary: "#134942", // Deep teal
 // white: "#FFFFFF",
//};

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-800">
      <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-100 shadow-sm">
        <div className="container flex h-16 max-w-screen-2xl items-center">
          {/* Logo/Brand Name */}
          <Link to="/" className="mr-8 flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center">
              <span className="text-white font-bold text-sm">RD</span>
            </div>
            <span className="font-bold text-emerald-800 text-lg tracking-tight">
              Raize
            </span>
          </Link>

          {/* Desktop Navigation (Hidden on Mobile) */}
          <nav className="hidden md:flex items-center space-x-6 mr-auto">
            <Link
              to="/presales"
              className="text-sm font-medium text-gray-600 transition-colors hover:text-emerald-800"
            >
              Presales
            </Link>
            <Link
              to="/create"
              className="text-sm font-medium text-gray-600 transition-colors hover:text-emerald-800"
            >
              Create
            </Link>
            <Link
              to="/profile"
              className="text-sm font-medium text-gray-600 transition-colors hover:text-emerald-800"
            >
              Profile
            </Link>
          </nav>

          {/* Right side items (Theme Toggle, Wallet Button, Mobile Menu Trigger) */}
          <div className="flex flex-1 items-center justify-end space-x-4">
            <ThemeToggle />
            <ConnectWalletButton />

            {/* Mobile Menu Trigger (Visible on Mobile) */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button
                  variant="outline"
                  size="icon"
                  className="border-emerald-800 text-emerald-800 hover:bg-emerald-50"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-64 border-r-emerald-100 bg-white"
              >
                <nav className="grid gap-6 text-lg font-medium mt-8 flex-grow">
                  <Link
                    to="/"
                    className="flex items-center gap-2 text-lg font-semibold"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">PD</span>
                    </div>
                    <span className="font-bold text-emerald-800">
                      Raize
                    </span>
                  </Link>
                  <div className="space-y-4">
                    <Link
                      to="/presales"
                      className="block text-gray-600 hover:text-emerald-800 transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Presales
                    </Link>
                    <Link
                      to="/create"
                      className="block text-gray-600 hover:text-emerald-800 transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Create
                    </Link>
                    <Link
                      to="/profile"
                      className="block text-gray-600 hover:text-emerald-800 transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Profile
                    </Link>
                  </div>
                </nav>
                {/* Footer section in mobile menu */}
                <div className="mt-auto border-t border-gray-100 pt-6">
                  <div className="flex justify-center space-x-6 mb-6">
                    <a
                      href="#"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-800 hover:text-emerald-600 transition-colors"
                    >
                      <FaTwitter size={20} />
                    </a>
                    <a
                      href="#"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-800 hover:text-emerald-600 transition-colors"
                    >
                      <FaFacebook size={20} />
                    </a>
                    <a
                      href="#"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-800 hover:text-emerald-600 transition-colors"
                    >
                      <FaYoutube size={20} />
                    </a>
                  </div>
                  <div className="flex justify-center">
                    <ThemeToggle />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1 container max-w-screen-2xl py-12">
        {children || <Outlet />}
      </main>

      <footer className="py-8 bg-emerald-800 text-white">
        <div className="container mx-auto max-w-screen-2xl px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Presale DApp</h3>
              <p className="text-sm text-emerald-100">
                Join us on our journey to unlock great things in the
                decentralized world.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Quick Links</h3>
              <ul className="text-sm space-y-2">
                <li>
                  <Link
                    to="/presales"
                    className="text-emerald-100 hover:text-white transition-colors"
                  >
                    Presales
                  </Link>
                </li>
                <li>
                  <Link
                    to="/create"
                    className="text-emerald-100 hover:text-white transition-colors"
                  >
                    Create
                  </Link>
                </li>
                <li>
                  <Link
                    to="/profile"
                    className="text-emerald-100 hover:text-white transition-colors"
                  >
                    Profile
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Connect With Us</h3>
              <div className="flex space-x-4">
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-100 hover:text-white transition-colors"
                >
                  <FaTwitter size={24} />
                </a>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-100 hover:text-white transition-colors"
                >
                  <FaFacebook size={24} />
                </a>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-100 hover:text-white transition-colors"
                >
                  <FaYoutube size={24} />
                </a>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-emerald-700 text-center md:text-left">
            <p className="text-sm text-emerald-100">
              © {new Date().getFullYear()} Raize DApp. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
