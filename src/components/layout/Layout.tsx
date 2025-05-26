import React, { useState, useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import ConnectWalletButton from "./ConnectWalletButton";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { FaTwitter, FaFacebook, FaYoutube } from "react-icons/fa";
import { DialogTitle, DialogDescription } from "@radix-ui/react-dialog";

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-white to-emerald-50 text-gray-800 relative overflow-x-hidden">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Animated Gradient Orbs */}
        <div
          className="absolute w-96 h-96 bg-gradient-to-r from-emerald-200/30 to-emerald-400/20 rounded-full blur-3xl animate-pulse"
          style={{
            left: `${mousePosition.x * 0.02}px`,
            top: `${mousePosition.y * 0.02}px`,
            transform: "translate(-50%, -50%)",
          }}
        />
        <div
          className="absolute w-64 h-64 bg-gradient-to-r from-emerald-300/20 to-emerald-600/10 rounded-full blur-2xl animate-bounce"
          style={{
            right: `${mousePosition.x * -0.01}px`,
            bottom: `${mousePosition.y * -0.01}px`,
            animationDuration: "6s",
          }}
        />

        {/* Floating Geometric Shapes */}
        <div
          className="absolute top-20 left-10 w-4 h-4 bg-emerald-400/30 rotate-45 animate-spin"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute top-40 right-20 w-6 h-6 bg-emerald-500/20 rounded-full animate-bounce"
          style={{ animationDuration: "4s" }}
        />
        <div className="absolute bottom-32 left-32 w-3 h-3 bg-emerald-600/40 rotate-12 animate-pulse" />
      </div>

      {/* Redesigned Premium Navbar */}
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-500 ${
          scrolled
            ? "bg-white/90 backdrop-blur-2xl border-b border-emerald-100/50 shadow-2xl shadow-emerald-500/10"
            : "bg-white/70 backdrop-blur-md border-b border-emerald-100/30"
        }`}
      >
        <div className="w-full px-6 sm:px-8 lg:px-12 xl:px-16">
          <div className="flex h-24 items-center justify-between relative max-w-7xl mx-auto">
            {/* Logo Section - Enhanced for custom logo */}
            {/* Logo Section - Using custom logo image */}
            <Link
              to="/"
              className="flex items-center space-x-4 group relative z-10"
            >
              <div className="relative">
                {/* Logo image with styled container */}
                <div className="w-14 h-14 rounded-2xl  to-emerald-800 flex items-center justify-center shadow-2xl group-hover:shadow-emerald-500/50 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
                  <img
                    src="/logo.png"
                    alt="Raize Logo"
                    className="w-10 h-10 object-contain"
                  />
                </div>
                {/* Glow effect on hover */}
                <div className="absolute inset-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 opacity-0 group-hover:opacity-40 blur-xl transition-all duration-500 scale-110" />
              </div>

              {/* Brand Name and Tagline */}
              <div className="flex flex-col">
                <span className="font-black text-3xl bg-gradient-to-r from-emerald-700 to-emerald-900 bg-clip-text text-transparent tracking-tight group-hover:from-emerald-600 group-hover:to-emerald-800 transition-all duration-300">
                  Raize
                </span>
                {/* <span className="text-xs font-semibold text-emerald-600/70 -mt-1 tracking-widest uppercase opacity-80 group-hover:opacity-100 transition-all duration-300">
                  Elite DeFi Platform
                </span> */}
              </div>
            </Link>

            {/* Enhanced Desktop Navigation - Centered */}
            <nav className="hidden lg:flex items-center space-x-2 absolute left-1/2 transform -translate-x-1/2">
              {[
                { to: "/presales", label: "Presales", icon: "🚀" },
                { to: "/create", label: "Create", icon: "⚡" },
                { to: "/profile", label: "Profile", icon: "👤" },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group relative px-8 py-4 text-base font-semibold text-gray-700 transition-all duration-300 hover:text-emerald-700 rounded-2xl hover:bg-emerald-50/80 hover:shadow-lg hover:shadow-emerald-500/20"
                >
                  <span className="relative z-10 flex items-center space-x-3">
                    <span className="text-lg opacity-70 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110">
                      {item.icon}
                    </span>
                    <span className="tracking-wide">{item.label}</span>
                  </span>
                  {/* Enhanced Hover Background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-100/60 to-emerald-200/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 scale-95 group-hover:scale-100" />
                  {/* Active Indicator */}
                  <div className="absolute bottom-1 left-1/2 w-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-300 group-hover:w-12 -translate-x-1/2" />
                </Link>
              ))}
            </nav>

            {/* Right Side Controls - Enhanced Spacing */}
            <div className="flex items-center space-x-6">
              {/* Theme Toggle - Hidden on small screens */}
              <div className="hidden md:block">
                <div className="p-2 rounded-xl hover:bg-emerald-50/80 transition-all duration-300">
                  <ThemeToggle />
                </div>
              </div>

              {/* Enhanced Connect Wallet Button */}
              <div className="relative group">
                <ConnectWalletButton />
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/30 to-emerald-600/30 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500 -z-10 scale-110" />
              </div>

              {/* Elite Mobile Menu Button */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-14 h-14 border-2 border-emerald-600/30 text-emerald-700 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-emerald-100 hover:border-emerald-500 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/20 hover:rotate-3 backdrop-blur-sm rounded-2xl"
                  >
                    <Menu className="h-7 w-7" />
                    <span className="sr-only">Toggle Menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-80 border-r border-emerald-100/50 bg-white/95 backdrop-blur-2xl shadow-2xl"
                >
                  {/* Accessibility */}
                  <DialogTitle className="sr-only">Main Menu</DialogTitle>
                  <DialogDescription className="sr-only">
                    Navigation and wallet actions for Raize DApp.
                  </DialogDescription>
                  <div className="flex flex-col h-full">
                    {/* Mobile Logo */}
                    <Link
                      to="/"
                      className="flex items-center gap-4 text-xl font-semibold mb-12 p-6 rounded-2xl hover:bg-emerald-50/80 transition-all duration-300"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <div className="w-14 h-14 rounded-2xl  to-emerald-800 flex items-center justify-center shadow-2xl group-hover:shadow-emerald-500/50 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
                        <img
                          src="/logo.png"
                          alt="Raize Logo"
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-2xl bg-gradient-to-r from-emerald-700 to-emerald-900 bg-clip-text text-transparent">
                          Raize
                        </span>
                        {/* <span className="text-xs font-medium text-emerald-600/70 tracking-widest uppercase">
                          Elite DeFi Platform
                        </span> */}
                      </div>
                    </Link>

                    {/* Mobile Navigation */}
                    <nav className="flex-grow space-y-2 px-2">
                      {[
                        {
                          to: "/presales",
                          label: "Presales",
                          icon: "🚀",
                          desc: "Discover new projects",
                        },
                        {
                          to: "/create",
                          label: "Create",
                          icon: "⚡",
                          desc: "Launch your presale",
                        },
                        {
                          to: "/profile",
                          label: "Profile",
                          icon: "👤",
                          desc: "Manage your account",
                        },
                      ].map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          className="group flex items-center space-x-5 p-5 rounded-2xl text-gray-700 hover:text-emerald-700 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-emerald-100/80 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <div className="text-3xl group-hover:scale-110 transition-transform duration-300">
                            {item.icon}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-lg">
                              {item.label}
                            </div>
                            <div className="text-sm text-gray-500 group-hover:text-emerald-600 transition-colors duration-300">
                              {item.desc}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </nav>

                    {/* Mobile Footer */}
                    <div className="border-t border-emerald-100/50 pt-8 mt-8">
                      <div className="flex justify-center space-x-6 mb-8">
                        {[
                          {
                            Icon: FaTwitter,
                            href: "#",
                            color: "hover:text-blue-500",
                            name: "twitter",
                          },
                          {
                            Icon: FaFacebook,
                            href: "#",
                            color: "hover:text-blue-600",
                            name: "facebook",
                          },
                          {
                            Icon: FaYoutube,
                            href: "#",
                            color: "hover:text-red-500",
                            name: "youtube",
                          },
                        ].map(({ Icon, href, color, name }) => (
                          <a
                            key={name}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`p-4 rounded-2xl bg-emerald-700/50 text-emerald-100 ${color} hover:text-white transition-all duration-300 hover:scale-110 hover:rotate-6 backdrop-blur-sm hover:shadow-2xl`}
                          >
                            <Icon size={28} />
                          </a>
                        ))}
                      </div>
                      <div className="flex justify-center">
                        <ThemeToggle />
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Main Content */}
      <main className="flex-1 container max-w-screen-2xl py-16 relative z-10">
        {children || <Outlet />}
      </main>

      {/* Premium Footer */}
      <footer className="relative py-16 bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 text-white overflow-hidden">
        {/* Footer Background Effects */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.03%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />

        <div className="container mx-auto max-w-screen-2xl px-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            {/* Brand Section */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl">
                  <span className="text-white font-bold text-lg">RD</span>
                </div>
                <div>
                  <h3 className="font-black text-2xl bg-gradient-to-r from-emerald-300 to-white bg-clip-text text-transparent">
                    Raize DApp
                  </h3>
                  <p className="text-emerald-200 text-sm font-medium tracking-wide uppercase">
                    Elite DeFi Platform
                  </p>
                </div>
              </div>
              <p className="text-emerald-100/90 leading-relaxed text-lg">
                Join us on our journey to unlock great things in the
                decentralized world. Experience the future of finance with
                cutting-edge technology.
              </p>
            </div>

            {/* Quick Links */}
            <div className="space-y-6">
              <h3 className="font-bold text-xl mb-6 text-emerald-300">
                Quick Links
              </h3>
              <ul className="space-y-4">
                {[
                  { to: "/presales", label: "Presales", icon: "🚀" },
                  { to: "/create", label: "Create", icon: "⚡" },
                  { to: "/profile", label: "Profile", icon: "👤" },
                ].map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="group flex items-center space-x-3 text-emerald-100 hover:text-white transition-all duration-300 hover:translate-x-2"
                    >
                      <span className="text-lg group-hover:scale-110 transition-transform duration-300">
                        {item.icon}
                      </span>
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Social Section */}
            <div className="space-y-6">
              <h3 className="font-bold text-xl mb-6 text-emerald-300">
                Connect With Us
              </h3>
              <div className="flex space-x-4">
                {[
                  {
                    Icon: FaTwitter,
                    href: "#",
                    color: "hover:bg-blue-500",
                    name: "twitter",
                  },
                  {
                    Icon: FaFacebook,
                    href: "#",
                    color: "hover:bg-blue-600",
                    name: "facebook",
                  },
                  {
                    Icon: FaYoutube,
                    href: "#",
                    color: "hover:bg-red-500",
                    name: "youtube",
                  },
                ].map(({ Icon, href, color, name }) => (
                  <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-4 rounded-2xl bg-emerald-700/50 text-emerald-100 ${color} hover:text-white transition-all duration-300 hover:scale-110 hover:rotate-6 backdrop-blur-sm hover:shadow-2xl`}
                  >
                    <Icon size={28} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="pt-8 border-t border-emerald-700/50">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-emerald-100/80 font-medium">
                © {new Date().getFullYear()} Raize DApp. All rights reserved.
              </p>
              <div className="flex items-center space-x-6 text-emerald-100/60">
                <span className="text-sm">Built with 💚 for DeFi</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
