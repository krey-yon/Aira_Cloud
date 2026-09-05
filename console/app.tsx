import { createRoot } from "react-dom/client";
import { ensureTokenFromUrl } from "./api/client";
import { useTheme } from "./hooks/useTheme";
import { useConsoleNav } from "./state/useConsoleNav";
import { ConsoleStage } from "./ui/ConsoleStage";

ensureTokenFromUrl();

function App() {
  const { nav, open, close, select, setFilter, startDraft } = useConsoleNav();
  const { theme, toggleTheme } = useTheme();

  return (
    <ConsoleStage
      nav={nav}
      theme={theme}
      onOpen={open}
      onClose={close}
      onSelect={select}
      onFilter={setFilter}
      onDraft={startDraft}
      onToggleTheme={toggleTheme}
    />
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");
createRoot(root).render(<App />);
