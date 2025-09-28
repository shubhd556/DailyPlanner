"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "theme.v1";

function getInitialTheme() {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    // default to system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

export default function ThemeToggle() {
    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch { }
    }, [theme]);

    const isDark = theme === "dark";
    const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

    return (
        <button
            className="link theme-btn"
            onClick={toggle}
            aria-pressed={!isDark}
            aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
            title={`Switch to ${isDark ? "light" : "dark"} theme`}
        >
            {isDark ? "🌞 Light" : "🌙 Dark"}
        </button>
    );
}
