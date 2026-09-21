import { Route, Switch } from "wouter";
import AdminPage from "./pages/Admin";
import BookPage from "./pages/Book";
import HomePage from "./pages/Home";
import PageEditorPage from "./pages/PageEditor";

export default function App() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/admin/edit/:slug" component={PageEditorPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/:slug" component={BookPage} />
    </Switch>
  );
}
