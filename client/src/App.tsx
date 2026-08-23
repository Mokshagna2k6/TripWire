import { NavLink, Route, Routes } from "react-router-dom";
import Inspector from "./pages/Inspector.js";
import Policies from "./pages/Policies.js";
import Review from "./pages/Review.js";
import Feedback from "./pages/Feedback.js";

const NAV = [
  { to: "/", label: "Live Request Inspector" },
  { to: "/policies", label: "Policies" },
  { to: "/review", label: "Human Review" },
  { to: "/feedback", label: "Feedback" },
];

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-bold">TripWire AI</h1>
        <p className="text-xs text-slate-500">AI governance gateway — dashboard</p>
        <nav className="mt-3 flex gap-4 text-sm">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) => (isActive ? "font-semibold text-indigo-400" : "text-slate-400 hover:text-slate-200")}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-6">
        <Routes>
          <Route path="/" element={<Inspector />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/review" element={<Review />} />
          <Route path="/feedback" element={<Feedback />} />
        </Routes>
      </main>
    </div>
  );
}
