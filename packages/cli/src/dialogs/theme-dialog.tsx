import { useCallback, useRef, useEffect } from "react";

import { useDialog } from "../providers/dialog";

import DialogSearchList from "../components/dialog/dialog-search-list";

import { useTheme } from "../providers/theme";
import { getThemeList, type Theme } from "../theme";

const availableThemes = getThemeList();
export default function ThemeDialog() {
  const { setTheme, currentTheme } = useTheme();
  const { close } = useDialog();
  const originalThemeRef = useRef<Theme>(currentTheme);
  const confirmedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (!confirmedRef.current) setTheme(originalThemeRef.current);
    };
  }, [setTheme]);

  const handleSelect = useCallback(
    (theme: Theme) => {
      confirmedRef.current = true;
      setTheme(theme);
      close();
    },
    [close, setTheme],
  );

  const handleHighlight = useCallback(
    (theme: Theme) => setTheme(theme),
    [setTheme],
  );

  return (
    <DialogSearchList
      items={availableThemes}
      onSelect={handleSelect}
      onHighlight={handleHighlight}
      getKey={(theme: Theme) => theme.name}
      placeholder="Search Themes..."
      emptyText="No matching themes"
      filterFn={(theme, query) =>
        theme.name.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(theme, isSelected) => (
        <text selectable={false} fg={isSelected ? "black" : "white"}>
          {theme.name === currentTheme.name
            ? "\u0020\u2022\u0020"
            : "\u0020\u0020\u0020"}
          {theme.name}
        </text>
      )}
    />
  );
}
