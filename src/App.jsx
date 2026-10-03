import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Home from "./pages/Home";
import { apiRequest } from "./api";

function App() {
  const [route, setRoute] = useState(() => (
    window.location.pathname === "/console" ? "checking" : "login"
  ));

  useEffect(() => {
    let revision = 0;
    let isMounted = true;

    const resolveRoute = async () => {
      const currentRevision = ++revision;
      if (window.location.pathname !== "/console") {
        if (window.location.pathname !== "/") window.history.replaceState({}, "", "/");
        if (isMounted) setRoute("login");
        return;
      }

      if (isMounted) setRoute("checking");
      try {
        await apiRequest("/api/auth/session");
        if (isMounted && revision === currentRevision) setRoute("console");
      } catch {
        if (revision !== currentRevision) return;
        window.history.replaceState({}, "", "/");
        if (isMounted) setRoute("login");
      }
    };

    void resolveRoute();
    const handlePopState = () => { void resolveRoute(); };
    window.addEventListener("popstate", handlePopState);
    return () => {
      isMounted = false;
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const navigate = (nextRoute, replace = false) => {
    const path = nextRoute === "console" ? "/console" : "/";
    if (window.location.pathname !== path) {
      if (replace) window.history.replaceState({}, "", path);
      else window.history.pushState({}, "", path);
    }
    setRoute(nextRoute);
  };

  const grantAccess = () => {
    navigate("console");
  };

  const endAccess = async () => {
    try {
      await apiRequest("/api/auth/logout", {});
    } catch {
      // The backend may already be offline; leave the protected page either way.
    }
    navigate("login", true);
  };

  return (
    <div className="App">
      {route === "checking" ? (
        <div className="session-checking" role="status">Checking your secure session…</div>
      ) : route === "login" ? (
        <Login onLoginSuccess={grantAccess} />
      ) : (
        <Home onLogout={endAccess} />
      )}
    </div>
  );
}

export default App;
