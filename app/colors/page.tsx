'use client';

/**
 * Colors showcase page displaying all color tokens from globals.css
 *
 * Input data sources: CSS custom properties from globals.css
 * Output destinations: Visual display of color tokens with their usage information
 * Dependencies: React hooks, Tailwind CSS classes, UI components
 * Key exports: Colors page component
 * Side effects: Toggles dark mode class on html element, stores preference in localStorage
 */

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ColorPair = {
  name: string;
  foregroundName: string;
  bgClass: string;
  textClass: string;
  cssVar: string;
  cssVarForeground: string;
};

type SingleColor = {
  name: string;
  bgClass: string;
  cssVar: string;
};

function ColorPairCard({
  pair,
  identicalTo,
}: {
  pair: ColorPair;
  identicalTo?: string[];
}) {
  const [bgValue, setBgValue] = useState<string>('');
  const [fgValue, setFgValue] = useState<string>('');

  useEffect(() => {
    const updateValues = () => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      setBgValue(computedStyle.getPropertyValue(pair.cssVar).trim());
      setFgValue(computedStyle.getPropertyValue(pair.cssVarForeground).trim());
    };

    updateValues();
    // Update when dark mode changes
    const observer = new MutationObserver(updateValues);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [pair.cssVar, pair.cssVarForeground]);

  return (
    <Card className="overflow-hidden">
      {/* Color Swatch Section */}
      <div className={cn('h-32 p-4 relative', pair.bgClass)}>
        <div
          className={cn('h-full flex flex-col justify-between', pair.textClass)}
        >
          <div className="font-mono text-xs opacity-70">
            Background: {pair.name}
          </div>
          <div className="space-y-1">
            <div className="text-xs opacity-70 mb-1">
              Foreground: {pair.foregroundName}
            </div>
            <div className="font-semibold text-lg">Example Text</div>
          </div>
        </div>
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold">Token Names</div>
          <div className="font-mono text-xs text-muted-foreground">
            <span className="font-semibold">Background:</span> {pair.name}
            <br />
            <span className="font-semibold">Foreground:</span>{' '}
            {pair.foregroundName}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-semibold">CSS Variables</div>
          <div className="font-mono text-xs text-muted-foreground break-all">
            <div className="mb-1">
              <span className="font-semibold">{pair.cssVar}</span> (background
              color)
              <br />
              <span className="text-muted-foreground/70">
                {bgValue || '...'}
              </span>
            </div>
            <div>
              <span className="font-semibold">{pair.cssVarForeground}</span>{' '}
              (text color)
              <br />
              <span className="text-muted-foreground/70">
                {fgValue || '...'}
              </span>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-semibold">Tailwind Classes</div>
          <div className="font-mono text-xs text-muted-foreground">
            <span className="font-semibold">{pair.bgClass}</span> (background)
            <br />
            <span className="font-semibold">{pair.textClass}</span> (text)
          </div>
        </div>
        {identicalTo && identicalTo.length > 0 && (
          <div className="rounded-md bg-muted/50 border border-muted-foreground/20 px-2 py-1.5">
            <div className="text-xs font-medium text-muted-foreground">
              ⚠️ Same color as: {identicalTo.join(', ')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SingleColorCard({
  color,
  identicalTo,
}: {
  color: SingleColor;
  identicalTo?: string[];
}) {
  const [value, setValue] = useState<string>('');

  useEffect(() => {
    const updateValue = () => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      setValue(computedStyle.getPropertyValue(color.cssVar).trim());
    };

    updateValue();
    const observer = new MutationObserver(updateValue);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [color.cssVar]);

  return (
    <Card className="overflow-hidden">
      {/* Color Swatch Section */}
      <div className={cn('h-32 p-4 relative', color.bgClass)}>
        <div className="h-full flex flex-col justify-end">
          <div className="text-xs opacity-70 font-mono">{color.name}</div>
        </div>
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold">Token Name</div>
          <div className="font-mono text-xs text-muted-foreground">
            {color.name}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-semibold">CSS Variable</div>
          <div className="font-mono text-xs text-muted-foreground break-all">
            <span className="font-semibold">{color.cssVar}</span>
            <br />
            <span className="text-muted-foreground/70">{value || '...'}</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-semibold">Tailwind Class</div>
          <div className="font-mono text-xs text-muted-foreground">
            <span className="font-semibold">{color.bgClass}</span>
          </div>
        </div>
        {identicalTo && identicalTo.length > 0 && (
          <div className="rounded-md bg-muted/50 border border-muted-foreground/20 px-2 py-1.5">
            <div className="text-xs font-medium text-muted-foreground">
              ⚠️ Same color as: {identicalTo.join(', ')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ColorsPage() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check localStorage and system preference
    const stored = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;
    const shouldBeDark = stored ? stored === 'true' : prefersDark;

    // Update DOM first, then state to avoid hydration issues
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Update state after DOM manipulation
    requestAnimationFrame(() => {
      setIsDark(shouldBeDark);
    });
  }, []);

  const toggleDarkMode = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    localStorage.setItem('darkMode', String(newIsDark));

    if (newIsDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const baseColors: ColorPair[] = [
    {
      name: 'background',
      foregroundName: 'foreground',
      bgClass: 'bg-background',
      textClass: 'text-foreground',
      cssVar: '--background',
      cssVarForeground: '--foreground',
    },
  ];

  const semanticPairs: ColorPair[] = [
    {
      name: 'primary',
      foregroundName: 'primary-foreground',
      bgClass: 'bg-primary',
      textClass: 'text-primary-foreground',
      cssVar: '--primary',
      cssVarForeground: '--primary-foreground',
    },
    {
      name: 'secondary',
      foregroundName: 'secondary-foreground',
      bgClass: 'bg-secondary',
      textClass: 'text-secondary-foreground',
      cssVar: '--secondary',
      cssVarForeground: '--secondary-foreground',
    },
    {
      name: 'accent',
      foregroundName: 'accent-foreground',
      bgClass: 'bg-accent',
      textClass: 'text-accent-foreground',
      cssVar: '--accent',
      cssVarForeground: '--accent-foreground',
    },
    {
      name: 'muted',
      foregroundName: 'muted-foreground',
      bgClass: 'bg-muted',
      textClass: 'text-muted-foreground',
      cssVar: '--muted',
      cssVarForeground: '--muted-foreground',
    },
  ];

  const containerPairs: ColorPair[] = [
    {
      name: 'card',
      foregroundName: 'card-foreground',
      bgClass: 'bg-card',
      textClass: 'text-card-foreground',
      cssVar: '--card',
      cssVarForeground: '--card-foreground',
    },
    {
      name: 'popover',
      foregroundName: 'popover-foreground',
      bgClass: 'bg-popover',
      textClass: 'text-popover-foreground',
      cssVar: '--popover',
      cssVarForeground: '--popover-foreground',
    },
  ];

  const sidebarPairs: ColorPair[] = [
    {
      name: 'sidebar',
      foregroundName: 'sidebar-foreground',
      bgClass: 'bg-sidebar',
      textClass: 'text-sidebar-foreground',
      cssVar: '--sidebar',
      cssVarForeground: '--sidebar-foreground',
    },
    {
      name: 'sidebar-primary',
      foregroundName: 'sidebar-primary-foreground',
      bgClass: 'bg-sidebar-primary',
      textClass: 'text-sidebar-primary-foreground',
      cssVar: '--sidebar-primary',
      cssVarForeground: '--sidebar-primary-foreground',
    },
    {
      name: 'sidebar-accent',
      foregroundName: 'sidebar-accent-foreground',
      bgClass: 'bg-sidebar-accent',
      textClass: 'text-sidebar-accent-foreground',
      cssVar: '--sidebar-accent',
      cssVarForeground: '--sidebar-accent-foreground',
    },
  ];

  const sidebarUtilities: SingleColor[] = [
    {
      name: 'sidebar-border',
      bgClass: 'bg-sidebar-border',
      cssVar: '--sidebar-border',
    },
    {
      name: 'sidebar-ring',
      bgClass: 'bg-sidebar-ring',
      cssVar: '--sidebar-ring',
    },
  ];

  const chartColors: SingleColor[] = [
    { name: 'chart-1', bgClass: 'bg-chart-1', cssVar: '--chart-1' },
    { name: 'chart-2', bgClass: 'bg-chart-2', cssVar: '--chart-2' },
    { name: 'chart-3', bgClass: 'bg-chart-3', cssVar: '--chart-3' },
    { name: 'chart-4', bgClass: 'bg-chart-4', cssVar: '--chart-4' },
    { name: 'chart-5', bgClass: 'bg-chart-5', cssVar: '--chart-5' },
  ];

  const utilityColors: SingleColor[] = [
    { name: 'destructive', bgClass: 'bg-destructive', cssVar: '--destructive' },
    { name: 'border', bgClass: 'bg-border', cssVar: '--border' },
    { name: 'input', bgClass: 'bg-input', cssVar: '--input' },
    { name: 'ring', bgClass: 'bg-ring', cssVar: '--ring' },
  ];

  return (
    <div className="min-h-screen bg-background p-6" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Color Tokens</h1>
            <p className="text-muted-foreground mt-2">
              Visual reference for all color tokens defined in globals.css
            </p>
          </div>
          <Button
            onClick={toggleDarkMode}
            variant="outline"
            size="icon"
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Base Colors */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Base Colors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {baseColors.map((pair) => (
              <ColorPairCard key={pair.name} pair={pair} />
            ))}
          </div>
        </section>

        {/* Semantic Pairs */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Semantic Pairs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {semanticPairs.map((pair) => {
              // Check if this color is identical to others
              let identicalTo: string[] | undefined;
              if (pair.name === 'secondary') {
                identicalTo = ['accent', 'muted'];
              } else if (pair.name === 'accent') {
                identicalTo = ['secondary', 'muted'];
              } else if (pair.name === 'muted') {
                identicalTo = ['secondary', 'accent'];
              }
              return (
                <ColorPairCard
                  key={pair.name}
                  pair={pair}
                  identicalTo={identicalTo}
                />
              );
            })}
          </div>
        </section>

        {/* Container Colors */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Container Colors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {containerPairs.map((pair) => {
              // Check if this color is identical to others
              let identicalTo: string[] | undefined;
              if (pair.name === 'card') {
                identicalTo = ['popover'];
              } else if (pair.name === 'popover') {
                identicalTo = ['card'];
              }
              return (
                <ColorPairCard
                  key={pair.name}
                  pair={pair}
                  identicalTo={identicalTo}
                />
              );
            })}
          </div>
        </section>

        {/* Sidebar Colors */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Sidebar Colors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sidebarPairs.map((pair) => (
              <ColorPairCard key={pair.name} pair={pair} />
            ))}
            {sidebarUtilities.map((color) => (
              <SingleColorCard key={color.name} color={color} />
            ))}
          </div>
        </section>

        {/* Chart Colors */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Chart Colors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chartColors.map((color) => (
              <SingleColorCard key={color.name} color={color} />
            ))}
          </div>
        </section>

        {/* Utility Colors */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Utility Colors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {utilityColors.map((color) => {
              // Check if this color is identical to others
              let identicalTo: string[] | undefined;
              if (color.name === 'border') {
                identicalTo = ['input'];
              } else if (color.name === 'input') {
                identicalTo = ['border'];
              }
              return (
                <SingleColorCard
                  key={color.name}
                  color={color}
                  identicalTo={identicalTo}
                />
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
