"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Home, Users, CheckSquare, Bell, BookOpen, Calendar, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface SidebarProps {
    children: React.ReactNode;
}

const menuItems = [
    // { href: "/", label: "홈", icon: Home },
    // { href: "/notice", label: "정보&공지사항", icon: Bell },
    { href: "/checkmate", label: "체크메이트", icon: CheckSquare },
    // { href: "/peer-learning", label: "컨텐츠 피어러닝", icon: Users },
    // { href: "/journaling", label: "스탠퍼드 저널링", icon: BookOpen },
    // { href: "/schedule", label: "스탠퍼드 일정표", icon: Calendar },
    // { href: "/mission", label: "스탠퍼드 임무표", icon: ClipboardList },
];

function NavItems({ onItemClick }: { onItemClick?: () => void }) {
    const pathname = usePathname();

    return (
        <nav className="flex flex-col gap-2">
            {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onItemClick}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                            isActive
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground",
                            (item as any).disabled && "opacity-50 pointer-events-none cursor-not-allowed"
                        )}
                    >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}

export function Sidebar({ children }: SidebarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className="flex min-h-screen">
            {/* 모바일 헤더 */}
            <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-4 bg-card/80 backdrop-blur-lg border-b border-border lg:hidden">
                <div className="flex items-center gap-3">
                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="lg:hidden">
                                <Menu className="w-6 h-6" />
                                <span className="sr-only">메뉴 열기</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-72 p-0">
                            <SheetTitle className="sr-only">메뉴</SheetTitle>
                            <div className="flex flex-col h-full">
                                <div className="flex items-center justify-between h-16 px-4 border-b border-border">
                                    <span className="text-xl font-bold">🎯 Aground Mastermind</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <X className="w-5 h-5" />
                                    </Button>
                                </div>
                                <div className="flex-1 p-4 overflow-y-auto">
                                    <NavItems onItemClick={() => setIsOpen(false)} />
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                    <span className="text-lg font-bold">🎯 Aground Mastermind</span>
                </div>
                <ThemeToggle />
            </header>

            {/* 데스크탑 사이드바 */}
            <aside
                className={cn(
                    "hidden lg:flex flex-col fixed top-0 left-0 h-full bg-card/80 backdrop-blur-lg border-r border-border z-40 transition-all duration-300",
                    isCollapsed ? "w-20" : "w-64"
                )}
            >
                <div className="flex items-center justify-between h-16 px-4 border-b border-border">
                    {!isCollapsed && (
                        <span className="text-xl font-bold">🎯 Aground Mastermind</span>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={cn(isCollapsed && "mx-auto")}
                    >
                        <Menu className="w-5 h-5" />
                    </Button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                    {isCollapsed ? (
                        <nav className="flex flex-col gap-2 items-center">
                            {menuItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "p-3 rounded-lg hover:bg-muted transition-colors",
                                            (item as any).disabled && "opacity-50 pointer-events-none cursor-not-allowed"
                                        )}
                                        title={item.label}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </Link>
                                );
                            })}
                        </nav>
                    ) : (
                        <NavItems />
                    )}
                </div>
                <div className="p-4 border-t border-border">
                    <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
                        {!isCollapsed && <span className="text-sm text-muted-foreground">테마</span>}
                        <ThemeToggle />
                    </div>
                </div>
            </aside>

            {/* 메인 콘텐츠 */}
            <main
                className={cn(
                    "flex-1 transition-all duration-300",
                    "pt-16 lg:pt-0", // 모바일에서 헤더 공간 확보
                    isCollapsed ? "lg:ml-20" : "lg:ml-64"
                )}
            >
                {children}
            </main>
        </div>
    );
}
