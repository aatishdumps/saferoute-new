import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, X, Loader2 } from "lucide-react";

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationSearchProps {
  placeholder: string;
  onSelect: (lat: number, lng: number, name: string) => void;
  className?: string;
}

export default function LocationSearch({ placeholder, onSelect, className = "" }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputContainerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!inputContainerRef.current) return;
    const rect = inputContainerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < 200;

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputContainerRef.current && !inputContainerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, results, updatePosition]);

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 3) { setResults([]); setIsOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + " Vadodara")}&limit=5&countrycodes=in`
        );
        const data: SearchResult[] = await res.json();
        setResults(data);
        setIsOpen(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const dropdown = isOpen && results.length > 0 && createPortal(
    <div
      className="z-[2000] glass-panel rounded-md overflow-hidden max-h-48 overflow-y-auto shadow-xl"
      style={dropdownStyle}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {results.map((r, i) => (
        <button
          key={i}
          onClick={() => {
            onSelect(parseFloat(r.lat), parseFloat(r.lon), r.display_name);
            setQuery(r.display_name.split(",")[0]);
            setIsOpen(false);
          }}
          className="w-full text-left px-3 py-2 text-xs font-mono text-foreground hover:bg-muted/80 transition-colors border-b border-border/50 last:border-0 line-clamp-2"
        >
          {r.display_name}
        </button>
      ))}
    </div>,
    document.body
  );

  return (
    <>
      <div ref={inputContainerRef} className={`relative ${className}`}>
        <div className="flex items-center gap-1.5 rounded-md bg-muted/50 border border-border px-2.5 py-1.5">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none min-w-0"
          />
          {isSearching && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />}
          {query && !isSearching && (
            <button onClick={() => { setQuery(""); setResults([]); setIsOpen(false); }}>
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      </div>
      {dropdown}
    </>
  );
}
