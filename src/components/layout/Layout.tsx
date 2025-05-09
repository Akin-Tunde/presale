import React, { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import ConnectWalletButton from './ConnectWalletButton';
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { FaTwitter, FaFacebook, FaYoutube } from 'react-icons/fa'; // Import social icons

interface LayoutProps {
    children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen flex flex-col">
            <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 max-w-screen-2xl items-center">
                    {/* Logo/Brand Name */}
                    <Link to="/" className="mr-6 flex items-center space-x-2">
                        <span className="font-bold">Presale DApp</span>
                    </Link>

                    {/* Desktop Navigation (Hidden on Mobile) */}
                    <nav className="hidden md:flex items-center space-x-4 lg:space-x-6 mr-auto">
                        <Link to="/presales" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                            Presales
                        </Link>
                        <Link to="/create" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                            Create
                        </Link>
                        <Link to="/profile" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                            Profile
                        </Link>
                    </nav>

                    {/* Right side items (Theme Toggle, Wallet Button, Mobile Menu Trigger) */}
                    <div className="flex flex-1 items-center justify-end space-x-2 md:space-x-4">
                        <ThemeToggle />
                        <ConnectWalletButton />

                        {/* Mobile Menu Trigger (Visible on Mobile) */}
                        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                            <SheetTrigger asChild className="md:hidden">
                                <Button variant="outline" size="icon">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">Toggle Menu</span>
                                </Button>
                            </SheetTrigger>
                            {/* Apply reduced width class here */}
                            <SheetContent side="left" className="w-40 sm:w-48 flex flex-col">
                                <nav className="grid gap-3 text-lg font-medium mt-6 flex-grow">
                                    <Link
                                        to="/"
                                        className="flex items-center gap-2 text-lg font-semibold"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        <span className="font-bold">Presale DApp</span>
                                    </Link>
                                    <Link
                                        to="/presales"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        Presales
                                    </Link>
                                    <Link
                                        to="/create"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        Create
                                    </Link>
                                    <Link
                                        to="/profile"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        Profile
                                    </Link>
                                </nav>
                                {/* Footer section in mobile menu */}
                                <div className="mt-auto border-t pt-4">
                                    <div className="flex justify-center space-x-4 mb-4">
                                        <a href="#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><FaTwitter size={20} /></a>
                                        <a href="#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><FaFacebook size={20} /></a>
                                        <a href="#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><FaYoutube size={20} /></a>
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
            <main className="flex-1 container max-w-screen-2xl py-8">
                {children || <Outlet />}
            </main>
            <footer className="py-6 md:px-8 md:py-0 border-t">
                <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
                    <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
                        Walk with us in unlocking great things
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default Layout;

