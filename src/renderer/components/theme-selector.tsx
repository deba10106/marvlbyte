import { Moon, Sun, Laptop, Palette } from "lucide-react";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { themes } from "../lib/utils";

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={theme === t.value ? "bg-accent" : ""}
          >
            {t.value === "light" && <Sun className="mr-2 h-4 w-4" />}
            {t.value === "dark" && <Moon className="mr-2 h-4 w-4" />}
            {t.value === "system" && <Laptop className="mr-2 h-4 w-4" />}
            {(t.value === "nord" || t.value === "cyberpunk") && (
              <Palette className="mr-2 h-4 w-4" />
            )}
            {t.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs text-muted-foreground">
          Theme: {theme}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
