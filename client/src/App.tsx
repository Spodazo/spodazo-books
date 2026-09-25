import { useEffect, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import { clearBookOpen, onBookOpenChange, openingSince } from "./lib/bookOpen";
import AdminPage from "./pages/Admin";
import BookPage from "./pages/Book";
import HomePage from "./pages/Home";
import PageEditorPage from "./pages/PageEditor";
import PortraitEditorPage from "./pages/PortraitEditor";

export default function App() {
  const [path] = useLocation();
  const [, setTick] = useState(0);
  useEffect(() => onBookOpenChange(() => setTick((value) => value + 1)), []);

  const onHome = path === "/";
  const onAdmin = path.startsWith("/admin");
  const holdHome = !onHome && !onAdmin && openingSince() > 0;

  useEffect(() => {
    if (onHome) clearBookOpen();
  }, [onHome]);

  return (
    <>
      {(onHome || holdHome) && <HomePage />}
      {onAdmin ? (
        <Switch>
          <Route path="/admin/edit/:slug" component={PageEditorPage} />
          <Route path="/admin/portrait/:slug" component={PortraitEditorPage} />
          <Route path="/admin" component={AdminPage} />
        </Switch>
      ) : onHome ? null : (
        <BookPage />
      )}
    </>
  );
}
