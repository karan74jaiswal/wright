import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME_COLORS,
  DEFAULT_THEME_NAME,
  DEFAULT_THEMES,
  type Theme,
  type ThemeColors,
} from "../../theme";

interface ThemeContextValue {
  colors: ThemeColors;
  currentTheme: Theme;
  setTheme(theme: Theme): void;
}

interface ThemePreferences {
  themeName: string;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);

const CONFIG_DIR = join(homedir(), ".wright");
const PREFERENCES_PATH = join(CONFIG_DIR, "prefs.json");

function getInitialTheme(): Theme {
  try {
    const preferences = JSON.parse(
      readFileSync(PREFERENCES_PATH, {
        encoding: "utf-8",
      }),
    ) as Partial<ThemePreferences>;

    const savedTheme = {
      name: preferences.themeName ? preferences.themeName : DEFAULT_THEME_NAME,

      colors: preferences?.themeName
        ? DEFAULT_THEMES[preferences.themeName]!
        : DEFAULT_THEME_COLORS,
    };

    return savedTheme;
  } catch (err: any) {
    console.log(err);
    return {
      name: DEFAULT_THEME_NAME,
      colors: DEFAULT_THEME_COLORS,
    };
  }
}

function persistTheme(themeName: string) {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });

    writeFileSync(
      PREFERENCES_PATH,
      JSON.stringify({ themeName } satisfies ThemePreferences, null, 2),
      {
        encoding: "utf8",
      },
    );
  } catch (err) {}
}

export default function ThemeProvider({
  children,
}: PropsWithChildren): ReactNode {
  const [currentTheme, setCurrentTheme] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((theme: Theme) => {
    setCurrentTheme(theme);
    persistTheme(theme.name);
  }, []);

  const values = useMemo(
    () => ({ currentTheme, setTheme, colors: currentTheme.colors }),
    [currentTheme, setTheme],
  );
  return (
    <ThemeContext.Provider value={values}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const values = useContext(ThemeContext);
  if (!values) throw new Error("useTheme Must be used within a Theme Provider");
  return values;
};
