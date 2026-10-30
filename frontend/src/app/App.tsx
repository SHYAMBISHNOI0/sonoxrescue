import { lazy, Suspense, useEffect, useState } from "react";
import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Activity,
  LayoutDashboard,
  ScanLine,
  SearchCheck,
  Network,
  FlaskConical,
  ShieldCheck,
  ChartNoAxesCombined,
  ScrollText,
  HeartPulse,
  Settings2,
  PanelLeftClose,
  Menu,
  Search,
  Bell,
  ChevronDown,
  ArrowUpRight,
  X,
  Command,
  Play,
  LogIn,
} from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Modal, SearchField, Badge, Field } from "../components/ui";
import { isHttp, useData, usePreferences } from "../services";
import type { Role } from "../types";
const Overview = lazy(() => import("../features/Overview"));
const Studies = lazy(() => import("../features/Studies"));
const Investigations = lazy(() => import("../features/Investigations"));
const Simulator = lazy(() => import("../features/Simulator"));
const Recovery = lazy(() => import("../features/Recovery"));
const Insights = lazy(() => import("../features/Insights"));
const navigation = [
  ["/", "Overview", LayoutDashboard],
  ["/studies", "Imaging Studies", ScanLine],
  ["/investigations", "Investigations", SearchCheck],
  ["/graph", "Evidence Graph", Network],
  ["/simulator", "Workflow Simulator", FlaskConical],
  ["/recovery", "Recovery Center", ShieldCheck],
  ["/analytics", "Analytics", ChartNoAxesCombined],
  ["/audit", "Audit Trail", ScrollText],
  ["/health", "System Health", HeartPulse],
  ["/research", "Research Lab", Activity],
  ["/settings", "Settings", Settings2],
] as const;
const roles: Role[] = [
  "Administrator",
  "Imaging technician",
  "Radiology reviewer",
  "Clinical safety reviewer",
  "Read-only observer",
];
export default function App() {
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [palette, setPalette] = useState(false),
    [query, setQuery] = useState(""),
    [notifications, setNotifications] = useState(false),
    [profile, setProfile] = useState(false),
    [password, setPassword] = useState(""),
    [loginError, setLoginError] = useState("");
  const { role, setRole, reduced, toast, notify } = usePreferences();
  const location = useLocation();
  const navigate = useNavigate();
  const { data, error, refetch, isLoading } = useData();
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if (e.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => notify(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast, notify]);
  useEffect(() => {
    setMobile(false);
    document.title = `${navigation.find((n) => n[0] === location.pathname)?.[1] ?? "Investigation"} · SonoRescue`;
  }, [location.pathname]);
  async function login() {
    try {
      const response = await fetch("/api/v1/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, password }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.detail);
      sessionStorage.setItem("sonorescue-token", body.access_token);
      setProfile(false);
      setPassword("");
      await refetch();
    } catch (e) {
      setLoginError(String(e));
    }
  }
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "user"}>
      <div
        className={`app ${collapsed ? "collapsed" : ""} ${mobile ? "mobile-open" : ""}`}
      >
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {mobile && (
          <button
            className="drawer-overlay"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          />
        )}
        <aside className="sidebar">
          <NavLink to="/" className="brand" aria-label="SonoRescue overview">
            <span className="brand-symbol">
              <Activity size={25} />
            </span>
            <span>
              Sono<span className="brand-light">Rescue</span>
              <small>IMAGING INTEGRITY</small>
            </span>
          </NavLink>
          <div className="workspace-label">
            WORKSPACE <span>01</span>
          </div>
          <nav aria-label="Main navigation">
            {navigation.map(([path, label, Icon], i) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""} ${i === 6 ? "nav-break" : ""}`
                }
                title={label}
                aria-label={label}
              >
                <Icon size={18} />
                <span>{label}</span>
                {path === "/investigations" && (
                  <b>
                    {data?.investigations.filter((i) => i.status !== "Resolved")
                      .length ?? 0}
                  </b>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="research-note">
              <span className="live-dot" /> RESEARCH PROTOTYPE
              <p>
                Every scan accounted for.
                <br />
                Every decision explained.
              </p>
              <small>Synthetic data only</small>
            </div>
            <button
              className="collapse-button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={17} />
              <span>Collapse sidebar</span>
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                onClick={() => setMobile(true)}
              >
                <Menu size={21} />
              </button>
              <span className="hospital-icon">H</span>
              <select aria-label="Hospital environment">
                <option>Demo Hospital</option>
              </select>
              <span className="top-divider" />
              <span className="environment">
                <span className="live-dot" />
                {isHttp ? "API simulation" : "Simulation mode"}
              </span>
            </div>
            <div className="topbar-right">
              <button
                className="command-button"
                aria-label="Open command palette"
                onClick={() => setPalette(true)}
              >
                <Search size={17} />
                <span>Search anything</span>
                <kbd>⌘ K</kbd>
              </button>
              <button
                className="icon-button notification-button"
                aria-label="Notifications"
                onClick={() => setNotifications(true)}
              >
                <Bell size={19} />
                <i />
              </button>
              <button
                className="avatar"
                aria-label="User profile and role"
                onClick={() => setProfile(true)}
              >
                DR
              </button>
              <ChevronDown size={14} />
            </div>
          </header>
          <main id="main">
            <div className="context-line">
              <span>
                Workspace <span>/</span>{" "}
                {navigation.find((n) => n[0] === location.pathname)?.[1] ??
                  "Investigation detail"}
              </span>
              <span>
                <span className="live-dot" />{" "}
                {isHttp ? "Backend connected" : "Local demo environment"}
              </span>
            </div>
            {error ? (
              <div className="error-state">
                <h1>Unable to load the environment</h1>
                <p>{error.message}</p>
                <button className="button" onClick={() => refetch()}>
                  Try again
                </button>
                {isHttp && (
                  <button
                    className="button primary"
                    onClick={() => setProfile(true)}
                  >
                    <LogIn size={16} /> Sign in
                  </button>
                )}
              </div>
            ) : isLoading ? (
              <div className="loading" aria-label="Loading environment">
                <div />
                <div />
                <div />
              </div>
            ) : (
              data && (
                <Suspense
                  fallback={
                    <div className="loading">
                      <div />
                      <div />
                    </div>
                  }
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={location.pathname}
                      initial={{ opacity: 0, y: 7 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.16 }}
                    >
                      <Routes>
                        <Route path="/" element={<Overview data={data} />} />
                        <Route
                          path="/studies"
                          element={<Studies data={data} />}
                        />
                        <Route
                          path="/investigations/*"
                          element={<Investigations data={data} />}
                        />
                        <Route
                          path="/graph"
                          element={<Investigations data={data} graphOnly />}
                        />
                        <Route
                          path="/simulator"
                          element={<Simulator data={data} />}
                        />
                        <Route
                          path="/recovery"
                          element={<Recovery data={data} />}
                        />
                        {[
                          "analytics",
                          "audit",
                          "health",
                          "research",
                          "settings",
                        ].map((page) => (
                          <Route
                            key={page}
                            path={`/${page}`}
                            element={<Insights data={data} page={page} />}
                          />
                        ))}
                        <Route
                          path="*"
                          element={
                            <div className="empty">
                              <h1>Page not found</h1>
                              <NavLink to="/">Return to overview</NavLink>
                            </div>
                          }
                        />
                      </Routes>
                    </motion.div>
                  </AnimatePresence>
                </Suspense>
              )
            )}
            <footer className="footer">
              <span>
                <Activity size={13} /> SonoRescue <span>·</span> TEG-UR Research
                Platform
              </span>
              <span>Synthetic environment · Not for clinical use</span>
            </footer>
          </main>
        </div>
      </div>
      <Modal
        open={palette}
        onClose={() => setPalette(false)}
        title="Find your next step"
        description="Search pages, studies, and investigation records. Ctrl or Command + K."
      >
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search pages, patient ID, accession…"
        />
        <div className="command-results">
          {navigation
            .filter((n) => n[1].toLowerCase().includes(query.toLowerCase()))
            .map(([path, label, Icon]) => (
              <button
                key={path}
                onClick={() => {
                  navigate(path);
                  setPalette(false);
                  setQuery("");
                }}
              >
                <Icon size={18} />
                {label}
                <ArrowUpRight size={15} />
              </button>
            ))}
          {query &&
            data?.studies
              .filter((s) =>
                `${s.id} ${s.patient} ${s.accession}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .slice(0, 8)
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    navigate(`/studies?study=${s.id}`);
                    setPalette(false);
                    setQuery("");
                  }}
                >
                  <ScanLine size={18} />
                  {s.id} · {s.patient}
                  <ArrowUpRight size={15} />
                </button>
              ))}
        </div>
        <small>
          <Command size={12} /> Navigate with Tab, select with Enter, close with
          Escape.
        </small>
      </Modal>
      <Modal
        open={notifications}
        onClose={() => setNotifications(false)}
        title="Your attention, where it matters"
      >
        <p>
          {data?.investigations.filter((i) => i.status !== "Resolved").length ??
            0}{" "}
          investigations require review.
        </p>
        {data?.investigations.slice(0, 4).map((i) => (
          <button
            className="notification-row"
            key={i.id}
            onClick={() => {
              navigate(`/investigations/${i.id}`);
              setNotifications(false);
            }}
          >
            <Badge>{i.severity}</Badge>
            <span>
              {i.category}
              <small>{i.id}</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </Modal>
      <Modal
        open={profile}
        onClose={() => setProfile(false)}
        title={isHttp ? "Sign in to the research environment" : "Demo reviewer"}
        description={
          isHttp
            ? "Use the demo password configured on your backend. Roles are enforced by the server."
            : "Choose a synthetic role to explore permission states."
        }
      >
        <Field label="Role">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        {isHttp ? (
          <>
            <Field label="Demo password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {loginError && <p role="alert">{loginError}</p>}
            <button className="button primary" onClick={login}>
              Sign in
            </button>
          </>
        ) : (
          <p className="callout">
            Role changes apply to local synthetic workflows only. Backend mode
            uses authenticated sessions.
          </p>
        )}
      </Modal>
      {toast && (
        <div className="toast" role="status">
          <ShieldCheck size={18} />
          <span>{toast}</span>
          <button aria-label="Dismiss notification" onClick={() => notify("")}>
            <X size={16} />
          </button>
        </div>
      )}
      <NavLink className="demo-fab" to="/simulator?guided=1">
        <Play size={14} /> Guided demo
      </NavLink>
    </MotionConfig>
  );
}
